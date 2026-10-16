package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestCheckTotal(t *testing.T) {
	tests := []struct {
		prev, cur int
		ok        bool
	}{
		{0, 500, true},
		{1000, 1000, true},
		{1000, 1100, true},
		{1000, 900, true},
		{1000, 1101, false},
		{1000, 899, false},
	}
	for _, tt := range tests {
		if err := checkTotal(tt.prev, tt.cur); (err == nil) != tt.ok {
			t.Errorf("checkTotal(%d, %d) = %v, want ok=%v", tt.prev, tt.cur, err, tt.ok)
		}
	}
}

func TestWriteMonthAndIndex(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "data")
	now := date("2026-10-14")

	if exists, err := monthExists(dir, "2026-10"); err != nil || exists {
		t.Fatalf("monthExists before write = %v, %v", exists, err)
	}
	if prev, err := previousTotal(dir); err != nil || prev != 0 {
		t.Fatalf("previousTotal with no data = %d, %v", prev, err)
	}

	s := Summary{Ratings: map[int]int{900: 2, 950: 1}, Total: 3}
	if err := writeMonth(dir, date("2026-10-13"), now, s); err != nil {
		t.Fatal(err)
	}
	if err := writeMonth(dir, date("2026-09-08"), now, Summary{Ratings: map[int]int{}, Total: 7}); err != nil {
		t.Fatal(err)
	}

	var month MonthFile
	if err := readJSON(monthPath(dir, "2026-10"), &month); err != nil {
		t.Fatal(err)
	}
	if month.TotalPlayers != 3 || month.Ratings[900] != 2 || month.RatingsUpdate != "2026-10-13" ||
		month.GeneratedAt != "2026-10-14" || month.ActiveWindowMonths != activeWindowMonths {
		t.Errorf("month file = %+v", month)
	}

	idx, err := readIndex(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(idx.Months, []string{"2026-09", "2026-10"}) || idx.Latest != "2026-10" {
		t.Errorf("index = %+v", idx)
	}
	if prev, err := previousTotal(dir); err != nil || prev != 3 {
		t.Errorf("previousTotal = %d, %v; want 3", prev, err)
	}

	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if e.Name()[0] == '.' {
			t.Errorf("leftover temp file %s", e.Name())
		}
	}
}

func TestRatingsKeysSerializeAsStrings(t *testing.T) {
	dir := t.TempDir()
	s := Summary{Ratings: map[int]int{750: 1}, Total: 1}
	if err := writeMonth(dir, date("2026-10-13"), date("2026-10-13"), s); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(monthPath(dir, "2026-10"))
	if !strings.Contains(string(b), `"750": 1`) {
		t.Errorf("unexpected output:\n%s", b)
	}
}

func TestLoadDotEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# comment\nPDGA_TEST_A=one\nexport PDGA_TEST_B=\"two\"\nPDGA_TEST_C=from-file\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PDGA_TEST_C", "from-env")
	for _, key := range []string{"PDGA_TEST_A", "PDGA_TEST_B"} {
		t.Setenv(key, "")
		os.Unsetenv(key)
	}

	if err := loadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]string{
		"PDGA_TEST_A": "one", "PDGA_TEST_B": "two", "PDGA_TEST_C": "from-env",
	} {
		if got := os.Getenv(key); got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
	if err := loadDotEnv(filepath.Join(t.TempDir(), "missing")); err != nil {
		t.Errorf("missing file: %v", err)
	}
}
