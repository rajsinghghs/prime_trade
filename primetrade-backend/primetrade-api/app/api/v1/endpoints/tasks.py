from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.schemas.schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse, MessageResponse
)
from app.services.task_service import TaskService
from app.core.dependencies import get_current_active_user
from app.models.models import User, TaskStatus, TaskPriority

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TaskService.create_task(db, payload, current_user)


@router.get(
    "/",
    response_model=TaskListResponse,
    summary="List tasks (paginated, filterable)",
    description="Users see their own tasks. Admins see all tasks.",
)
def list_tasks(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[TaskStatus] = Query(None, description="Filter by status"),
    priority: Optional[TaskPriority] = Query(None, description="Filter by priority"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TaskService.get_tasks(db, current_user, page, page_size, status, priority)


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Get a single task by ID",
)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TaskService.get_task_by_id(db, task_id, current_user)


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Partially update a task",
)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TaskService.update_task(db, task_id, payload, current_user)


@router.delete(
    "/{task_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft delete a task",
)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    TaskService.delete_task(db, task_id, current_user)
    return MessageResponse(message="Task deleted successfully")
