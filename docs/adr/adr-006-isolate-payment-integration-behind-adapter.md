# ADR-006: Isolate Payment Integration Behind an Adapter

## Status

Accepted.

Payment-provider selection and the production deposit strategy remain separate, deferred decisions.

## Context

Marketplace payouts and authorization durations depend on the provider. Direct provider calls throughout the application would couple business rules to one SDK. An adapter requires extra mapping code but permits sandbox and production implementations behind the same contract. Selecting an unverified renewal interval would make deposit protection uncertain.

## Decision

Payment owns its adapter and transaction ledger. The current demo uses a local ledger adapter without real money to model separate fee and deposit authorizations, fee capture at pickup, and settlement after an accepted return. Model authorization expiry explicitly; the deposit remains reserved after fee capture until settlement. Local settlement changes are atomic and financial operation identifiers are unique. Real-provider integration, provider reconciliation, provider selection, and the production deposit strategy remain deferred.

## Consequences

The adapter keeps provider-specific code out of Booking and Rental. Test local ledger outcomes, expiry, declined authorization, duplicate requests, and settlement retry. Before production, validate authorization duration, renewal, and payouts, then implement uncertain or partial provider-outcome reconciliation and proactive payment-risk alerts that preserve custody and distinguish secured funds from shortfalls. The demo is not evidence that these external-provider capabilities are complete.
