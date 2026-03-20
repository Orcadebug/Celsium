# ForgeSync Architecture (v0 -> v2)

## v0 (Git-compatible)
- Agent sessions (`session/start`, `session/end`)
- Memory + decisions + locks + tasks
- CLI lifecycle wrappers

## v1 (Intent-primary)
- Intent objects as first-class records
- Decision lineage graph
- Proof bundles as merge/apply gate

## v2 (Git-optional)
- Native project graph as source of truth
- GitHub import/export compatibility layer

## Mandatory pillars included
- Determinism + replay
- Policy engine core
- Semantic conflict model
- Evaluation framework
- Full lineage
- Git migration strategy