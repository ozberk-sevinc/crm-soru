package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/ozberk-sevinc/crm-soru/backend/internal/practice"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	bank, err := practice.LoadBank(env("QUESTION_BANK", "data/questions.json"))
	if err != nil {
		log.Fatal(err)
	}
	if len(os.Args) > 1 && os.Args[1] == "validate-bank" {
		log.Printf("Validated %d questions and %d outcomes", len(bank.Questions), len(bank.Outcomes))
		return
	}
	store, err := practice.OpenStore(env("STATE_PATH", "var/state.json"))
	if err != nil {
		log.Fatal(err)
	}
	demo := os.Getenv("DEMO_MODE") == "true"
	admin := os.Getenv("ADMIN_TOKEN")
	verifier, err := practice.NewGoogleVerifier(strings.Split(os.Getenv("GOOGLE_CLIENT_IDS"), ","))
	if err != nil {
		log.Fatal(err)
	}
	adminEmails := map[string]bool{}
	for _, email := range strings.Split(os.Getenv("GOOGLE_ADMIN_EMAILS"), ",") {
		if email = strings.ToLower(strings.TrimSpace(email)); email != "" {
			adminEmails[email] = true
		}
	}
	adminSubjects := map[string]bool{}
	for _, subject := range strings.Split(os.Getenv("GOOGLE_ADMIN_SUBJECTS"), ",") {
		if subject = strings.TrimSpace(subject); subject != "" {
			adminSubjects[subject] = true
		}
	}
	if !demo && len(admin) < 32 && (verifier == nil || len(adminEmails)+len(adminSubjects) == 0) {
		log.Fatal("Configure Google client IDs and an admin allowlist, or set a random ADMIN_TOKEN of at least 32 characters. DEMO_MODE is for local development only.")
	}
	api := &practice.API{Bank: bank, Store: store, AdminToken: admin, Demo: demo, VerifyGoogle: verifier, GoogleAdminEmails: adminEmails, GoogleAdminSubjects: adminSubjects}
	if err = api.ValidatePublished(); err != nil {
		log.Fatal("Invalid published question bank: ", err)
	}
	server := &http.Server{Addr: env("LISTEN_ADDR", "127.0.0.1:8080"), Handler: api.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 60 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	log.Printf("CRM Soru API listening on %s (demo=%t)", server.Addr, demo)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
