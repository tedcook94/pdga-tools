package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testSessid = "secret-sessid"

type fakePDGA struct {
	total       int
	failFirst   int32
	failures    atomic.Int32
	pageCalls   atomic.Int32
	loggedOut   atomic.Bool
	lastRequest atomic.Int64
	minGap      atomic.Int64
}

func (f *fakePDGA) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	now := time.Now().UnixNano()
	if prev := f.lastRequest.Swap(now); prev != 0 {
		gap := now - prev
		if cur := f.minGap.Load(); cur == 0 || gap < cur {
			f.minGap.Store(gap)
		}
	}

	switch r.URL.Path {
	case "/user/login":
		json.NewEncoder(w).Encode(map[string]string{
			"sessid": testSessid, "session_name": "SESS", "token": "tok",
		})
	case "/user/logout":
		if !f.authorized(r) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		f.loggedOut.Store(true)
		w.Write([]byte(`[true]`))
	case "/players":
		if !f.authorized(r) {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if f.failures.Add(1) <= f.failFirst {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		f.pageCalls.Add(1)
		f.writePage(w, r)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (f *fakePDGA) authorized(r *http.Request) bool {
	c, err := r.Cookie("SESS")
	return err == nil && c.Value == testSessid && r.Header.Get("X-CSRF-Token") == "tok"
}

func (f *fakePDGA) writePage(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset >= f.total {
		json.NewEncoder(w).Encode(map[string]int{"status": 1})
		return
	}
	var rows []map[string]any
	for n := offset + 1; n <= min(offset+limit, f.total); n++ {
		rows = append(rows, map[string]any{
			"pdga_number":           strconv.Itoa(n),
			"rating":                "900",
			"rating_effective_date": "2026-10-13",
		})
	}
	json.NewEncoder(w).Encode(map[string]any{"status": 0, "players": rows})
}

func newTestClient(t *testing.T, f *fakePDGA) *Client {
	t.Helper()
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	c := NewClient()
	c.BaseURL = srv.URL
	c.Delay = 0
	c.RetryBackoff = time.Millisecond
	return c
}

func TestFetchPlayersPagesUntilEnd(t *testing.T) {
	f := &fakePDGA{total: 450}
	c := newTestClient(t, f)
	ctx := context.Background()

	if err := c.Login(ctx, "u", "p"); err != nil {
		t.Fatal(err)
	}
	players, err := c.FetchPlayers(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(players) != 450 {
		t.Errorf("got %d players, want 450", len(players))
	}
	if got := f.pageCalls.Load(); got != 4 {
		t.Errorf("page calls = %d, want 4 (3 data pages + end)", got)
	}
	if err := c.Logout(ctx); err != nil {
		t.Fatal(err)
	}
	if !f.loggedOut.Load() {
		t.Error("logout not received")
	}
}

func TestFetchPlayersMaxPages(t *testing.T) {
	f := &fakePDGA{total: 1000}
	c := newTestClient(t, f)
	ctx := context.Background()
	if err := c.Login(ctx, "u", "p"); err != nil {
		t.Fatal(err)
	}
	players, err := c.FetchPlayers(ctx, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(players) != 400 {
		t.Errorf("got %d players, want 400", len(players))
	}
}

func TestRetriesServerErrors(t *testing.T) {
	f := &fakePDGA{total: 10, failFirst: 2}
	c := newTestClient(t, f)
	ctx := context.Background()
	if err := c.Login(ctx, "u", "p"); err != nil {
		t.Fatal(err)
	}
	players, err := c.FetchPlayers(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(players) != 10 {
		t.Errorf("got %d players, want 10", len(players))
	}
}

func TestGivesUpAfterMaxAttempts(t *testing.T) {
	f := &fakePDGA{total: 10, failFirst: maxAttempts}
	c := newTestClient(t, f)
	ctx := context.Background()
	if err := c.Login(ctx, "u", "p"); err != nil {
		t.Fatal(err)
	}
	_, err := c.FetchPlayers(ctx, 0)
	var statusErr *httpStatusError
	if !errors.As(err, &statusErr) || statusErr.Code != http.StatusServiceUnavailable {
		t.Fatalf("err = %v, want 503 after retries", err)
	}
}

func TestDoesNotRetryClientErrors(t *testing.T) {
	f := &fakePDGA{total: 10}
	c := newTestClient(t, f)
	_, err := c.FetchPlayers(context.Background(), 0)
	var statusErr *httpStatusError
	if !errors.As(err, &statusErr) || statusErr.Code != http.StatusForbidden {
		t.Fatalf("err = %v, want 403", err)
	}
	if got := f.failures.Load(); got != 0 {
		t.Errorf("players endpoint reached %d times past auth, want 0", got)
	}
}

func TestErrorsNeverContainSessid(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"sessid":"` + testSessid + `"}`))
	}))
	t.Cleanup(srv.Close)
	c := NewClient()
	c.BaseURL = srv.URL
	c.Delay = 0

	err := c.Login(context.Background(), "u", "p")
	if err == nil || strings.Contains(err.Error(), testSessid) {
		t.Fatalf("err = %v", err)
	}
}

func TestThrottle(t *testing.T) {
	f := &fakePDGA{total: 600}
	c := newTestClient(t, f)
	c.Delay = 20 * time.Millisecond
	ctx := context.Background()
	if err := c.Login(ctx, "u", "p"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.FetchPlayers(ctx, 0); err != nil {
		t.Fatal(err)
	}
	if gap := time.Duration(f.minGap.Load()); gap < c.Delay {
		t.Errorf("min gap between requests = %s, want >= %s", gap, c.Delay)
	}
}

func TestCanceledContextStops(t *testing.T) {
	f := &fakePDGA{total: 10}
	c := newTestClient(t, f)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := c.Login(ctx, "u", "p"); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
}
