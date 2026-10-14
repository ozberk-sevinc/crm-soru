package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
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
	if !demo && len(admin) < 32 {
		log.Fatal("Set ADMIN_TOKEN to a random value of at least 32 characters, or explicitly enable DEMO_MODE for local development")
	}
	api := &practice.API{Bank: bank, Store: store, AdminToken: admin, Demo: demo}
	server := &http.Server{Addr: env("LISTEN_ADDR", "127.0.0.1:8080"), Handler: api.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
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
