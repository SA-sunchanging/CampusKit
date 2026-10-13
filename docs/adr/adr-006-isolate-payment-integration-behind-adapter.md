# ADR-006: Isolate Payment Integration Behind an Adapter

## Status

Accepted.

Payment-provider selection and the production deposit strategy remain separate, deferred decisions.

## Context

Marketplace payouts and authorization durations depend on the provider. Direct provider calls throughout the application would couple business rules to one SDK. An adapter requires extra mapping code but permits sandbox and production implementations behind the same contract. Selecting an unverified renewal interval would make deposit protection uncertain.

## Decision

Payment owns the adapter, transaction ledger, and reconciliation. Demonstrate separate fee and deposit authorizations, fee capture at pickup, and settlement after an accepted return using sandbox/test operations. Model authorization expiry explicitly rather than assuming a hold lasts throughout every rental. Provider selection and the production deposit strategy remain deferred.

## Consequences

The team must define the adapter contract, implement sandbox/test outcomes, and test expiry, declined authorization, partial settlement, and reconciliation. Production integration requires validating renewal and payout support. Failed coverage after pickup needs a payment-risk workflow that preserves custody and distinguishes secured funds from shortfalls.
