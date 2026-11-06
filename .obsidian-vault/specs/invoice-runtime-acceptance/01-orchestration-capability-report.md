# Orchestration Capability Report

The Copilot task and background-agent interfaces are available. Existing campaign agents are visible and can receive follow-up work. Earlier exploratory launches failed with HTTP 400 `The requested model is not supported`; this is recorded as a model-capability limitation, not treated as successful delegation.

Direct terminal execution is available for Node, pnpm, Docker, Prisma, and repository tests. Browser tooling is present in the environment, but no authenticated isolated identity provider or storage service is configured in the repository.

No agent is authorized to declare the campaign accepted. The lead remains responsible for integration and final status.

