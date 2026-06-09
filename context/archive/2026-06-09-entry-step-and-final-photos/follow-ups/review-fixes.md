# Impl-review triage fixes (2026-06-09)

All 7 findings addressed during triage:

- **F1**: Plan addendum documents entry-list thumbnail preview (S-06 early ship).
- **F2**: Row-count verification (`.select("id").maybeSingle()`) in step/final photo helpers.
- **F3**: Remove flow nulls DB before Storage delete; best-effort cleanup on Storage failure.
- **F4**: Upload rollback skips Storage delete when replacing an existing photo.
- **F5**: Step delete runs RPC before Storage cleanup.
- **F6**: Magic-byte sniffing in `parseOptionalPhotoFile`; declared MIME must match content.
- **F7**: Batch signed URLs via `createSignedPhotoUrlMap` for steps list and entry list.
