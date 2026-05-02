import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from backend.db import (
    create_discussion, get_discussion, list_discussions, list_all_discussions,
    get_discussion_messages, insert_messages, update_discussion, archive_discussion
)
from backend.routes_auth import get_current_user, require_admin

router = APIRouter(prefix="/api/discussions", tags=["discussions"])


class CreateDiscussionRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    participants: list[dict]


class AppendMessagesRequest(BaseModel):
    messages: list[dict]


class UpdateDiscussionRequest(BaseModel):
    summary: Optional[dict] = None
    status: Optional[str] = None


# --- User Endpoints ---

@router.post("")
async def create_discussion_endpoint(req: CreateDiscussionRequest, user: dict = Depends(get_current_user)):
    disc = await create_discussion(
        user_id=user["id"],
        topic=req.topic,
        participants_json=json.dumps(req.participants)
    )
    return disc


@router.get("")
async def list_discussions_endpoint(user: dict = Depends(get_current_user)):
    discussions = await list_discussions(user["id"])
    return {"discussions": discussions}


@router.get("/{discussion_id}")
async def get_discussion_endpoint(discussion_id: str, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    messages = await get_discussion_messages(discussion_id)
    disc["messages"] = [{
        "id": m["id"],
        "senderId": m["sender_id"],
        "text": m["text"],
        "stance": m.get("stance"),
        "stanceIntensity": m.get("stance_intensity"),
        "actionDescription": m.get("action_description"),
        "timestamp": m["timestamp"],
    } for m in messages]
    return disc


@router.post("/{discussion_id}/messages")
async def append_messages_endpoint(discussion_id: str, req: AppendMessagesRequest, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    if len(req.messages) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 messages per request")
    count = await insert_messages(discussion_id, req.messages)
    return {"message_count": count}


@router.put("/{discussion_id}")
async def update_discussion_endpoint(discussion_id: str, req: UpdateDiscussionRequest, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    updates = {}
    if req.summary is not None:
        updates["summary"] = req.summary
    if req.status is not None:
        if req.status not in ("active", "archived"):
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'archived'")
        updates["status"] = req.status
    result = await update_discussion(discussion_id, **updates)
    return result


@router.delete("/{discussion_id}")
async def delete_discussion_endpoint(discussion_id: str, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    await archive_discussion(discussion_id)
    return {"detail": "Discussion archived"}


# --- Admin Endpoints ---

admin_router = APIRouter(prefix="/api/admin/discussions", tags=["admin-discussions"])


@admin_router.get("")
async def admin_list_discussions(search: str = "", admin: dict = Depends(require_admin)):
    discussions = await list_all_discussions(search)
    return {"discussions": discussions}


@admin_router.get("/{discussion_id}")
async def admin_get_discussion(discussion_id: str, admin: dict = Depends(require_admin)):
    from backend.db import get_connection
    db = await get_connection()
    async with db.execute(
        """SELECT d.*, u.name as user_name, u.email as user_email
           FROM discussions d JOIN users u ON d.user_id = u.id
           WHERE d.id = ?""",
        (discussion_id,)
    ) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Discussion not found")
        disc = dict(row)
        disc["participants"] = json.loads(disc.pop("participants_json"))
        if disc.get("summary_json"):
            disc["summary"] = json.loads(disc.pop("summary_json"))
        else:
            disc.pop("summary_json", None)
            disc["summary"] = None

    messages = await get_discussion_messages(discussion_id)
    disc["messages"] = [{
        "id": m["id"],
        "senderId": m["sender_id"],
        "text": m["text"],
        "stance": m.get("stance"),
        "stanceIntensity": m.get("stance_intensity"),
        "actionDescription": m.get("action_description"),
        "timestamp": m["timestamp"],
    } for m in messages]
    return disc


@admin_router.post("/{discussion_id}/messages")
async def admin_append_messages(discussion_id: str, req: AppendMessagesRequest, admin: dict = Depends(require_admin)):
    from backend.db import get_connection
    db = await get_connection()
    async with db.execute("SELECT * FROM discussions WHERE id = ?", (discussion_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Discussion not found")
    if len(req.messages) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 messages per request")
    count = await insert_messages(discussion_id, req.messages)
    return {"message_count": count}


@admin_router.put("/{discussion_id}")
async def admin_update_discussion(discussion_id: str, req: UpdateDiscussionRequest, admin: dict = Depends(require_admin)):
    updates = {}
    if req.summary is not None:
        updates["summary"] = req.summary
    if req.status is not None:
        updates["status"] = req.status
    result = await update_discussion(discussion_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Discussion not found")
    return result


@admin_router.delete("/{discussion_id}")
async def admin_delete_discussion(discussion_id: str, admin: dict = Depends(require_admin)):
    success = await archive_discussion(discussion_id)
    if not success:
        raise HTTPException(status_code=404, detail="Discussion not found")
    return {"detail": "Discussion archived"}
