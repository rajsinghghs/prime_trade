# Scalability Architecture Note — PrimeTrade API

## Current Architecture

```
Client → Load Balancer → [FastAPI Instance(s)] → PostgreSQL
                                               → Redis (cache / blacklist)
```

---

## Horizontal Scaling

**Stateless JWT** is the key enabler. Because auth state lives in signed tokens — not server memory or sticky sessions — any number of API instances can verify a request independently.

```
                  ┌─ API Pod 1 ─┐
Client ──► LB ──► ├─ API Pod 2 ─┤──► PostgreSQL Primary
                  └─ API Pod N ─┘
                        │
                        ▼
                      Redis
```

Deploy as Docker containers behind an **Nginx** or **AWS ALB** load balancer. Zero configuration changes needed — the `DATABASE_URL` and `SECRET_KEY` are shared via environment variables.

---

## Database Layer

| Strategy | Implementation |
|----------|---------------|
| **Connection pooling** | SQLAlchemy `QueuePool` — 10 base + 20 overflow per instance |
| **Read replicas** | Point read-heavy queries at a replica with a second engine |
| **Migrations** | Alembic — zero-downtime schema changes via `--autogenerate` |
| **Indexing** | Composite indexes on `(owner_id, status)` and `(owner_id, priority)` for O(log n) task lookups |
| **Soft delete** | `is_deleted` flag preserves history, keeps foreign key integrity |

---

## Caching with Redis

```python
# Example: Cache /api/v1/tasks list for 60s per user
@router.get("/")
async def list_tasks(current_user: User = Depends(...)):
    cache_key = f"tasks:{current_user.id}:{page}:{status}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    result = TaskService.get_tasks(...)
    await redis.setex(cache_key, 60, result.model_dump_json())
    return result
```

**Token blacklist** (for true logout):
```python
# On logout, add token jti to Redis with TTL = token remaining lifetime
await redis.setex(f"blacklist:{jti}", remaining_seconds, "1")
# On each request, check blacklist before serving
```

---

## Microservices Extraction Path

The service layer (`app/services/`) is already the boundary. When a module needs independent scaling:

```
Phase 1 (current):   Monolith with service layer
Phase 2:             Auth Service → separate FastAPI app + JWT shared secret
Phase 3:             Task Service → own DB + async messaging via RabbitMQ/Kafka
Phase 4:             API Gateway (Kong/Traefik) handles routing + rate limiting
```

The `app/models/`, `app/schemas/`, and `app/services/` pattern means each service already has a clean contract.

---

## Kubernetes Deployment (Production Path)

```yaml
# Simplified HPA config
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          averageUtilization: 70
```

**With:** PostgreSQL on RDS (Multi-AZ), Redis on ElastiCache, secrets in AWS Secrets Manager.

---

## Observability

- **Structured logging** via Python `logging` — each request logs method, path, status, latency
- **`X-Response-Time` header** on every response for p99 tracking
- **Health check** at `/health` for load balancer probes
- **Next step:** OpenTelemetry traces → Grafana / Datadog

---

## Summary Checklist

- [x] Stateless JWT → horizontal scale-out
- [x] DB connection pooling
- [x] Redis caching & token blacklist (wired, optional)
- [x] Soft delete for audit trail
- [x] Docker-ready (Dockerfile + Compose)
- [x] Modular service layer for microservice extraction
- [x] Composite DB indexes for query performance
- [ ] Read replicas (next step)
- [ ] Message queue (Kafka/RabbitMQ) for async tasks
- [ ] Kubernetes HPA + Ingress
- [ ] OpenTelemetry tracing
