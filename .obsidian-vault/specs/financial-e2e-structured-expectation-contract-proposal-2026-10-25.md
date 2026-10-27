# Pharmnos Lite Structured Financial E2E Expectation Contract Proposal

**Date:** 2026-10-25  
**Time:** 22-33-07 (IST)  
**Status:** `PROPOSAL — NON-EXECUTABLE — READY FOR HUMAN REVIEW`

## Purpose and boundaries

This document proposes a versioned, structured contract for expressing
source-grounded expectations for an isolated Financial E2E and GST validation
run. It is a design proposal only. It does not approve the contract, populate
[`financial-e2e-reviewed-expectations.json`](../../scripts/financial-e2e-reviewed-expectations.json),
approve the artifact manifest, authorize SQL, initialize a database, or
authorize GST, broader Financial E2E, or cleanup execution.

The proposal uses the owner decision package
([`financial-e2e-owner-decisions-2026-10-25.md`](./financial-e2e-owner-decisions-2026-10-25.md)),
the reviewed assertion mapping
([`gst-disposable-assertion-mapping-2026-10-25.md`](./gst-disposable-assertion-mapping-2026-10-25.md)),
the Prisma schema, the review-only security/RLS artifacts, and the
initialization/safety modules. Review-only artifacts and generated SQL describe
requirements or a deterministic baseline; they do not prove actual database
state.

## Design principles

1. Source-derived expectations, required connected observations, and actual
   observations are separate values and must never be collapsed.
2. Every assertion and every behavioral/evidence requirement has source and
   classification metadata.
3. Unresolved requirements are typed as unresolved, never represented by an
   invented value or a placeholder that could be parsed as a value.
4. A missing, ambiguous, contradictory, stale, or unresolved required
   assertion fails closed.
5. Generated SQL, review-only SQL, offline summaries, and synthetic flags are
   never live catalog evidence.
6. Contract design does not authorize implementation, expectation approval, or
   execution.

## Proposed contract status and metadata

The structured contract is versioned independently from the current flat-array
file (`version: 1`). A reader must not silently interpret one contract as the
other. The following is an illustrative shape, not an executable expectation
package:

```json
{
  "contractVersion": "0.1",
  "contractKind": "financial-e2e-structured-expectations",
  "status": "PROPOSAL_PENDING_REVIEW",
  "approved": false,
  "compatibility": {
    "readerRange": { "minimum": "0.1", "maximum": "0.1" },
    "writerVersion": "0.1",
    "unknownFields": "REJECT"
  },
  "sourceBinding": {
    "schema": {
      "path": "prisma/schema.prisma",
      "sha256": "<APPROVED_64_LOWERCASE_HEX_SHA256>"
    },
    "manifest": {
      "path": "prisma/financial-e2e-artifact-manifest.json",
      "sha256": "<APPROVED_64_LOWERCASE_HEX_SHA256>"
    },
    "artifacts": [
      {
        "path": "<REPOSITORY_RELATIVE_PATH>",
        "sha256": "<APPROVED_64_LOWERCASE_HEX_SHA256>",
        "classification": "REVIEW_ONLY"
      }
    ]
  },
  "unresolvedRequirements": [
    {
      "id": "RLS-MUTABLE-DELETE",
      "category": "rls",
      "status": "UNRESOLVED",
      "reason": "The review-only RLS and security artifacts do not agree on mutable-table DELETE policy behavior.",
      "owner": "SECURITY_DATABASE_REVIEW",
      "blocking": true,
      "source": [
        {
          "path": "prisma/financial-e2e-rls-policies.review.sql",
          "location": "L15-L31"
        },
        {
          "path": "prisma/financial-e2e-security-controls.review.sql",
          "location": "L105-L125"
        }
      ]
    },
    {
      "id": "EVIDENCE-PERSISTENCE",
      "category": "evidence",
      "status": "UNRESOLVED",
      "reason": "No authoritative source defines the evidence store, append-only mechanism, access controls, or retention period.",
      "owner": "OWNER",
      "blocking": true,
      "source": [
        {
          "path": "scripts/financial-e2e-connected-initialization-adapter.mjs",
          "location": "L34-L79"
        },
        {
          "path": "prisma/financial-e2e-artifact-manifest.json",
          "location": "verificationSteps"
        }
      ]
    }
  ],
  "assertions": {
    "schemas": [],
    "objects": [],
    "roles": [],
    "privileges": [],
    "defaultPrivileges": [],
    "ownership": [],
    "rls": [],
    "triggers": [],
    "functions": [],
    "service": [],
    "evidence": []
  }
}
```

The manifest currently binds the Prisma schema and five review-only artifacts,
and remains unapproved
([`financial-e2e-artifact-manifest.json`](../../prisma/financial-e2e-artifact-manifest.json:1-46)).
The hash placeholders above are intentionally invalid until an approved
contract supplies exact values. Hashes must be lowercase hexadecimal SHA-256
strings matching `^[a-f0-9]{64}$`; path values must be repository-relative,
normalized, and unique. The contract must bind both the manifest file hash and
the individual artifact hashes if both are required by the approved review.

## Formal value and assertion types

The following equivalent type specification is proposed. It is deliberately
non-executable and requires implementation approval before use.

```ts
type SourceRef = {
  path: string;              // repository-relative, never an absolute path
  location: string;          // "L1-L4", "section:...", or "symbol:..."
};

type Classification =
  | "SOURCE_DERIVED"
  | "REVIEW_SPECIFIED"
  | "SERVICE_LEVEL"
  | "CONNECTED_REQUIRED";

type Provenance = {
  source: SourceRef[];
  classification: Classification;
};

type Specified<T> = Provenance & {
  state: "SPECIFIED";
  value: T;
};

type Unresolved = Provenance & {
  state: "UNRESOLVED";
  reason: string;
  owner: "OWNER" | "SECURITY_REVIEW" | "DATABASE_REVIEW"
       | "APPLICATION_INTEGRITY_REVIEW" | "SECURITY_DATABASE_REVIEW";
  blocking: true;
};

type ConnectedRequired<T> = Provenance & {
  state: "CONNECTED_REQUIRED";
  requirement: T;
  observationFields: string[];
};

type ContractValue<T> = Specified<T> | Unresolved | ConnectedRequired<T>;

type Assertion<T> = {
  id: string;                // globally unique within the contract
  required: boolean;
  expectation: ContractValue<T>;
};

type Observed<T> = {
  assertionId: string;
  state: "OBSERVED";
  source: "CONNECTED_CATALOG" | "CONNECTED_RUNTIME" | "CONNECTED_EVIDENCE";
  value: T;
  targetBinding: string;
  runId: string;
  initializationAttemptId: string;
  verifiedAt: number;
  sourceSchemaSha256: string;
  artifactManifestSha256: string;
};
```

`Specified` describes what a trusted source says; it does not assert that the
live database contains it. `ConnectedRequired` says that a connected read-back
or test is mandatory; it does not contain an observation. `Observed` is only
valid when produced by an authorized connected run with independent identity,
marker, target, run, attempt, freshness, and hash binding. A source reference
or generated SQL statement can never be used as an `Observed` value.

### Required and optional fields

The top-level fields `contractVersion`, `contractKind`, `status`, `approved`,
`compatibility`, `sourceBinding`, `unresolvedRequirements`, and `assertions`
are required. Every assertion requires `id`, `required`, and `expectation`.
`source`, `classification`, and the state-specific fields are required by the
discriminated union. Optional fields may be added only through a reviewed
contract-version change; unknown fields are rejected.

`unresolvedRequirements` entries require `id`, `category`, `status`,
`reason`, `owner`, and `blocking: true`. An unresolved item may not be
represented by omission, an empty list, `false`, `null`, or a string ending in
`OR_UNRESOLVED`.

### Identity and duplicate detection

Assertion IDs must be unique across the entire contract. If an implementation
uses generated IDs, the proposed canonical identity is:

`<category>:<schema>:<object>:<property>:<qualifier>`

The exact identity grammar remains a contract-approval decision. Duplicate IDs,
duplicate source paths within one assertion, duplicate artifact paths, and
conflicting definitions for the same identity are validation failures. A
duplicate with byte-identical content is still rejected rather than silently
merged.

### Source-reference format

`SourceRef.path` must be a repository-relative POSIX-style path in the
contract, with no drive prefix, `..` traversal, or query fragment.
`SourceRef.location` must identify a line range such as `L15-L31`, a named
section, or a symbol. A source reference identifies provenance only; it is not
connected evidence.

## Schema and constraint assertions

The following shapes are proposed. Every field uses `ContractValue` (or an
`Assertion` containing it) so source facts, unresolved requirements, and
connected observations cannot be confused.

```ts
type SchemaAssertion = Assertion<{
  name: string;
  existsInSource: boolean;
  owner: ContractValue<string>;
}>;

type ColumnAssertion = Assertion<{
  schema: string;
  table: string;
  name: string;
  type: ContractValue<string>;
  nullable: ContractValue<boolean>;
  defaultExpression: ContractValue<string | null>;
  timestampBehavior: ContractValue<"NONE" | "NOW" | "UPDATED_AT" | "OTHER">;
}>;

type EnumAssertion = Assertion<{
  schema: string;
  name: string;
  labels: ContractValue<Array<{ label: string; ordinal: number }>>;
}>;

type KeyAssertion = Assertion<{
  kind: "PRIMARY_KEY" | "UNIQUE" | "INDEX";
  schema: string;
  table: string;
  name: ContractValue<string>;
  columns: string[];
  unique?: ContractValue<boolean>;
}>;

type ForeignKeyAssertion = Assertion<{
  name: ContractValue<string>;
  source: { schema: string; table: string; columns: string[] };
  target: { schema: string; table: string; columns: string[] };
  onDelete: ContractValue<string>;
  onUpdate: ContractValue<string>;
  tenantScope: ContractValue<boolean>;
}>;
```

The reviewed mapping contains 60 FK rows with composite order, actions,
generated names, and source/generated-SQL references
([`gst-disposable-assertion-mapping-2026-10-25.md`](./gst-disposable-assertion-mapping-2026-10-25.md:190-260)).
That mapping and generated SQL are source material, not proof of applied
constraints
([`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:1-4)).

### Proposed comparison and normalization semantics

These are proposed rules for review, not implemented behavior:

- PostgreSQL type comparison must use normalized catalog identity
  (`udt_schema`, `udt_name`, typmod/array/domain information) rather than
  display text. The exact Prisma-to-catalog mapping for every type remains
  unresolved until database review.
- Default expressions must be compared as parsed or otherwise
  PostgreSQL-normalized expressions, not raw whitespace. Whether Prisma
  `cuid()`, `now()`, and provider-generated expressions have equivalent
  catalog forms is unresolved and must not be guessed.
- Timestamp behavior must compare separately from the database default.
  `@updatedAt` may be application behavior rather than a database default;
  the source does not establish a universal catalog representation.
- Enum labels must compare exactly and in source order. Whether ordinals are
  represented zero-based or one-based is unresolved; no ordinal convention is
  approved here.
- Key and FK column arrays are ordered and must match exactly. Constraint-name
  comparison must distinguish source-generated names from connected catalog
  names.
- ACL comparison must use normalized `(object, grantee, privilege,
  grantor, grant-option)` rows. Effective privilege expansion, role
  inheritance, and PUBLIC handling require database-review rules.
- Ownership must compare exact catalog owner identity. Bootstrap ownership is
  a reviewed direction, not proof of live ownership.
- RLS predicates require exact approved expressions or a database-review
  semantic-normalization algorithm. Textual formatting alone is insufficient.
- Trigger and function comparison requires exact approved identity, owner,
  timing/events, argument types, security attributes, and approved behavior.
  Function-body equivalence and normalized definition comparison are
  unresolved because no final objects or definitions are source-defined.

## Security assertions

```ts
type RoleAssertion = Assertion<{
  name: string;
  login: ContractValue<boolean>;
  superuser: ContractValue<boolean>;
  bypassRls: ContractValue<boolean>;
  inherit: ContractValue<boolean>;
}>;

type PrivilegeAssertion = Assertion<{
  scope: "SCHEMA" | "TABLE" | "SEQUENCE" | "ROUTINE";
  object: string;
  grantee: string;
  privilege: string;
  grantOption: ContractValue<boolean>;
  expected: "GRANTED" | "REVOKED";
}>;

type OwnershipAssertion = Assertion<{
  object: string;
  owner: ContractValue<string>;
}>;
```

The security artifact supports the least-privilege direction, bootstrap/runtime
separation, schema restrictions, reviewed table grants, default revocations,
and restrictions on privileged function ownership
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-82)).
It does not define a complete ACL, sequence, routine, inheritance, ownership,
or effective-privilege matrix. Those values remain unresolved.

## RLS assertions and unresolved DELETE behavior

```ts
type RlsAssertion = Assertion<{
  schema: string;
  table: string;
  enabled: ContractValue<boolean>;
  forced: ContractValue<boolean>;
  policies: Array<{
    name: ContractValue<string>;
    command: ContractValue<"SELECT" | "INSERT" | "UPDATE" | "DELETE">;
    role: ContractValue<string>;
    using: ContractValue<string | null>;
    withCheck: ContractValue<string | null>;
  }>;
}>;
```

The RLS review specifies enabled/forced RLS, runtime policy families,
fail-closed tenant predicates, and relation-scoped exceptions
([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-80)).
The security review separately names `tenant_delete_<table>` for mutable tables
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125)).
This is an unresolved source conflict. The contract must retain a blocking
unresolved requirement for mutable-table DELETE behavior. It must not choose
omission, explicit policies, or a controlled function path, and it must not
invent policy names. The source-specific no-delete requirements for immutable
GST history, `tenants`, and `audit_logs` remain separate.

## Triggers, functions, and service assertions

```ts
type TriggerAssertion = Assertion<{
  schema: string;
  table: string;
  name: ContractValue<string>;
  timing: ContractValue<"BEFORE" | "AFTER" | "INSTEAD_OF">;
  events: ContractValue<Array<"INSERT" | "UPDATE" | "DELETE">>;
  function: ContractValue<string>;
  owner: ContractValue<string>;
  requiredBehavior: ContractValue<string>;
  sqlState: ContractValue<string | null>;
}>;

type FunctionAssertion = Assertion<{
  schema: string;
  name: ContractValue<string>;
  argumentTypes: ContractValue<string[]>;
  owner: ContractValue<string>;
  security: ContractValue<"INVOKER" | "DEFINER">;
  executePrivileges: ContractValue<string[]>;
  requiredBehavior: ContractValue<string>;
}>;

type ServiceAssertion = Assertion<{
  id: string;
  behavior: string;
  evidenceRequirements: string[];
}>;
```

The security review requires future immutable-history, finalized-invoice, and
posting controls, including SQLSTATE `42501` and `23514`, but does not define
exact installed objects, names, timing, bodies, or live state
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-198)).
Those fields therefore remain `UNRESOLVED` or `CONNECTED_REQUIRED`; no object
name or SQL definition is invented.

Service assertions must carry the same `source` and `classification` metadata
through `Assertion`. They remain separate from catalog assertions and may cover
unresolved-GST blocking, hashing, idempotency, concurrency, retry behavior,
rollback, and atomic invoice/stock/ledger/audit writes. The exact behavioral
test contract remains application-integrity-review work.

## Evidence requirements

```ts
type EvidenceAssertion = Assertion<{
  targetBinding: string;
  runId: string;
  initializationAttemptId: string;
  freshness: ContractValue<{ maxAgeMs: number }>;
  identityFields: string[];
  independentMarkerRequired: boolean;
  catalogFields: string[];
  sanitization: ContractValue<{ secretsRemoved: boolean }>;
  persistence: Unresolved | ContractValue<{
    mode: string;
    appendOnly: boolean;
    accessControl: string;
    retention: string;
  }>;
}>;
```

Target/run/attempt binding, freshness, independent marker and identity
verification, catalog checks, runtime RLS verification, and sanitized evidence
are required by the initialization contract and adapter
([`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:1-145);
[`financial-e2e-connected-initialization-adapter.mjs`](../../scripts/financial-e2e-connected-initialization-adapter.mjs:34-115)).
The safety module also requires target separation and role restrictions
([`financial-e2e-safety.mjs`](../../scripts/financial-e2e-safety.mjs:34-174)).

The repository does not establish an approved persistence location, append-only
mechanism, access-control matrix, or retention period. These remain blocking
unresolved requirements. No storage mechanism, access rule, or retention
period is proposed as a value.

## Validation and failure categories

The following validation behavior is proposed:

1. `UNSUPPORTED_CONTRACT_VERSION`: version or reader range is unsupported.
2. `MALFORMED_CONTRACT`: required fields, union discriminators, source refs,
   IDs, paths, or value types are malformed.
3. `UNKNOWN_FIELD`: a field is not defined by the selected contract version.
4. `INVALID_HASH`: a hash is not lowercase 64-character SHA-256 hex.
5. `INVALID_SOURCE_BINDING`: paths, manifest, artifact order, or hashes do not
   match the approved binding.
6. `DUPLICATE_ASSERTION`: assertion IDs, artifact paths, or identities repeat.
7. `CONFLICTING_ASSERTIONS`: one identity has incompatible definitions.
8. `UNRESOLVED_REQUIRED`: a required value or blocking requirement is
   unresolved, including mutable-table DELETE behavior.
9. `INVALID_COMPARISON`: a comparison cannot apply the approved normalization
   rule or encounters an unapproved type/ACL/predicate/function form.
10. `UNBOUND_OBSERVATION`: an observation lacks connected source, independent
    identity, marker, target, run, attempt, freshness, or approved hash
    binding.
11. `SYNTHETIC_EVIDENCE`: a summary flag, offline result, generated SQL, or
    review-only SQL is supplied as live catalog evidence.
12. `STALE_OR_CONTRADICTORY_EVIDENCE`: evidence is stale, future-dated,
    contradictory, unexpectedly privileged, or otherwise unsafe.

All failures are fail-closed. Empty arrays, omitted fields, `false`, `null`,
generated SQL, and review-only comments do not prove absence or live state.
These rules are proposed behavior, not implemented validation logic.

## Coverage and unresolved requirements

| Requirement | Expressible | Current position |
|---|---|---|
| Schemas, tables, columns, types, nullability, defaults | Yes | Source material exists; live existence and type/default normalization require connected review |
| Timestamp behavior and enum order | Yes | Source extractable; catalog mapping and ordinal convention unresolved |
| Keys, indexes, 60 foreign keys, order, actions | Yes | Mapping is source-reviewed; live constraints require catalog read-back |
| Roles, inheritance, ACLs, default ACLs, ownership | Yes | Directional requirements exist; exact matrices and effective privileges unresolved |
| RLS enabled/forced and policy fields | Yes | Reviewed direction exists; exact executable table set and predicates require approval |
| Mutable-table DELETE behavior | Yes, as unresolved | Conflicting review artifacts require security/database resolution |
| Immutable history and posting controls | Yes | Behavior/SQLSTATE direction exists; exact trigger/function objects unresolved |
| Service behavior | Yes, separate namespace | Test contract and runtime evidence remain application-integrity decisions |
| Target/run/attempt/freshness and connected identity | Yes | Required by current initialization/safety modules |
| Field-level connected catalog read-back | Yes | Required fields and authoritative queries remain database-review work |
| Sanitization | Yes | Sanitized evidence shape exists; connected provenance still required |
| Append-only storage, access controls, retention | Shape only | No authoritative repository values; remain unresolved |

## Authorization boundaries and next steps

The following gates remain distinct and unchanged:

1. Technical review of this non-executable proposal.
2. Approval of the contract design, version, validation, and unresolved-value
   representation.
3. Separate expectation drafting and owner approval of the expectation package.
4. Separately authorized connected database initialization.
5. Separately authorized GST execution.
6. Separately authorized broader Financial E2E execution.
7. Separately authorized cleanup and evidence retention handling.

No gate authorizes a later gate. In particular, contract design or human review
does not approve the expectation JSON, artifact manifest, SQL, database
initialization, GST execution, broader Financial E2E execution, or cleanup.

This document is ready for human technical review only. It is not approved,
executable, or proof of any connected database state.
