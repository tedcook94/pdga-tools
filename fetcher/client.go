package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const (
	defaultBaseURL = "https://api.pdga.com/services/json"
	pageSize       = 200
	maxAttempts    = 4
)

var errDecode = errors.New("decoding response failed")

type Client struct {
	BaseURL      string
	HTTP         *http.Client
	Delay        time.Duration
	RetryBackoff time.Duration
	Progress     func(pages, players int)

	sessionName string
	sessid      string
	token       string
	lastRequest time.Time
}

func NewClient() *Client {
	return &Client{
		BaseURL:      defaultBaseURL,
		HTTP:         &http.Client{Timeout: 60 * time.Second},
		Delay:        time.Second,
		RetryBackoff: 5 * time.Second,
	}
}

type httpStatusError struct {
	Code int
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("unexpected HTTP status %d", e.Code)
}

func (c *Client) Login(ctx context.Context, username, password string) error {
	body, err := json.Marshal(map[string]string{"username": username, "password": password})
	if err != nil {
		return err
	}
	var resp struct {
		Sessid      string `json:"sessid"`
		SessionName string `json:"session_name"`
		Token       string `json:"token"`
	}
	if err := c.do(ctx, http.MethodPost, "/user/login", body, &resp); err != nil {
		return fmt.Errorf("login: %w", err)
	}
	if resp.Sessid == "" || resp.SessionName == "" {
		return errors.New("login: response missing session")
	}
	c.sessid, c.sessionName, c.token = resp.Sessid, resp.SessionName, resp.Token
	return nil
}

func (c *Client) Logout(ctx context.Context) error {
	if c.sessid == "" {
		return nil
	}
	err := c.do(ctx, http.MethodPost, "/user/logout", nil, nil)
	c.sessid, c.sessionName, c.token = "", "", ""
	if err != nil {
		return fmt.Errorf("logout: %w", err)
	}
	return nil
}

func (c *Client) FetchPlayers(ctx context.Context, maxPages int) (map[string]Player, error) {
	players := map[string]Player{}
	for page := 0; maxPages <= 0 || page < maxPages; page++ {
		q := url.Values{
			"limit":  {strconv.Itoa(pageSize)},
			"offset": {strconv.Itoa(page * pageSize)},
		}
		var resp struct {
			Status  int      `json:"status"`
			Players []Player `json:"players"`
		}
		if err := c.do(ctx, http.MethodGet, "/players?"+q.Encode(), nil, &resp); err != nil {
			return nil, fmt.Errorf("players page %d: %w", page, err)
		}
		if resp.Status != 0 || len(resp.Players) == 0 {
			break
		}
		for _, p := range resp.Players {
			players[p.PDGANumber] = p
		}
		if c.Progress != nil {
			c.Progress(page+1, len(players))
		}
	}
	return players, nil
}

func (c *Client) FetchPlayerStatistics(ctx context.Context, year, maxPages int, visit func(PlayerStat)) (int, error) {
	rows := 0
	for page := 0; maxPages <= 0 || page < maxPages; page++ {
		q := url.Values{
			"year":   {strconv.Itoa(year)},
			"limit":  {strconv.Itoa(pageSize)},
			"offset": {strconv.Itoa(page * pageSize)},
		}
		var resp struct {
			Status  int          `json:"status"`
			Players []PlayerStat `json:"players"`
		}
		if err := c.do(ctx, http.MethodGet, "/player-statistics?"+q.Encode(), nil, &resp); err != nil {
			return rows, fmt.Errorf("player statistics %d page %d: %w", year, page, err)
		}
		if resp.Status != 0 || len(resp.Players) == 0 {
			break
		}
		for _, s := range resp.Players {
			visit(s)
		}
		rows += len(resp.Players)
		if c.Progress != nil {
			c.Progress(page+1, rows)
		}
	}
	return rows, nil
}

func (c *Client) do(ctx context.Context, method, path string, body []byte, out any) error {
	var err error
	for attempt := range maxAttempts {
		if attempt > 0 {
			if err := sleep(ctx, c.RetryBackoff<<(attempt-1)); err != nil {
				return err
			}
		}
		err = c.attempt(ctx, method, path, body, out)
		if !retryable(err) {
			return err
		}
	}
	return fmt.Errorf("after %d attempts: %w", maxAttempts, err)
}

func (c *Client) attempt(ctx context.Context, method, path string, body []byte, out any) error {
	if err := c.throttle(ctx); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	if c.sessid != "" {
		req.AddCookie(&http.Cookie{Name: c.sessionName, Value: c.sessid})
		req.Header.Set("X-CSRF-Token", c.token)
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Bodies are never included in errors because they contain sessid.
	if resp.StatusCode != http.StatusOK {
		return &httpStatusError{Code: resp.StatusCode}
	}
	if out == nil {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return errDecode
	}
	return nil
}

func (c *Client) throttle(ctx context.Context) error {
	if !c.lastRequest.IsZero() {
		if err := sleep(ctx, c.Delay-time.Since(c.lastRequest)); err != nil {
			return err
		}
	}
	c.lastRequest = time.Now()
	return nil
}

func retryable(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	if statusErr, ok := errors.AsType[*httpStatusError](err); ok {
		return statusErr.Code >= 500 || statusErr.Code == http.StatusTooManyRequests
	}
	return !errors.Is(err, errDecode)
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
