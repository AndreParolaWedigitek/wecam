from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import db

import camera
from camera import generate_frames

from datetime import datetime

import cv2
import mediapipe as mp
import base64

class UserRegistration(BaseModel):
    email: str
    password: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_mesh = mp.solutions.face_mesh

@app.get("/")
def home():

    return {
        "status": "ok",
        "message": "Face Recognition API"
    }

@app.post("/capture_user/{name}")
def capture_user(name: str, user_data: UserRegistration):

    if camera.last_frame is None:

        return {
            "success": False,
            "message": "Sem frame disponível"
        }

    user_id = f"user_{name.lower()}"

    if user_id in db:

        return {
            "success": False,
            "message": "Utilizador já existe"
        }

    frame = camera.last_frame.copy()

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True
    ) as face_mesh:

        results = face_mesh.process(rgb)

        if not results.multi_face_landmarks:

            return {
                "success": False,
                "message": "Nenhum rosto encontrado"
            }

        h, w, _ = frame.shape

        landmarks = []

        for idx, lm in enumerate(
            results.multi_face_landmarks[0].landmark
        ):

            landmarks.append({

                "id": idx,
                "x": float(lm.x),
                "y": float(lm.y)

            })

        doc = {

            "_id": user_id,
            "type": "user",
            "name": name,
            "email": user_data.email,
            "password": user_data.password,
            "created_at": datetime.now().isoformat(),
            "landmarks": landmarks

        }

        ret, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ret:
            photo_b64 = base64.b64encode(buf.tobytes()).decode('ascii')
            doc['photo'] = photo_b64

        db.save(doc)

        return {

            "success": True,
            "message": f"{name} registado com sucesso"

        }

@app.get("/users")
def users():

    result = []

    for doc_id in db:

        doc = db[doc_id]

        if doc.get("type") == "user":

            result.append({

                "id": doc_id,
                "name": doc.get("name"),
                "email": doc.get("email"),
                "created_at": doc.get("created_at"),
                "photo": doc.get("photo")

            })

    return result

@app.post("/detection/{person}")
def add_detection(person: str):

    doc = {

        "type": "detection",
        "person": person,
        "timestamp": datetime.now().isoformat()

    }

    if camera.last_frame is not None:
        ret, buf = cv2.imencode('.jpg', camera.last_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ret:
            photo_b64 = base64.b64encode(buf.tobytes()).decode('ascii')
            doc['photo'] = photo_b64

    db.save(doc)

    return {

        "success": True,
        "person": person

    }

@app.get("/detections")
def detections():

    result = []

    for doc_id in db:

        doc = db[doc_id]

        if doc.get("type") == "detection":

            result.append({

                "id": doc_id,
                "person": doc.get("person"),
                "timestamp": doc.get("timestamp"),
                "photo": doc.get("photo")

            })

    result.sort(
        key=lambda x: x["timestamp"],
        reverse=True
    )

    return result

@app.get("/stats")
def stats():

    counts = {}

    for doc_id in db:

        doc = db[doc_id]

        if doc.get("type") != "detection":
            continue

        person = doc.get("person")

        counts[person] = counts.get(
            person,
            0
        ) + 1

    return counts

@app.get("/summary")
def summary():

    total_detections = 0
    total_users = 0
    today_detections = 0

    hoje = datetime.now().date()

    for doc_id in db:

        doc = db[doc_id]

        if doc.get("type") == "detection":

            total_detections += 1

            timestamp = doc.get("timestamp")

            if timestamp:
                try:
                    data = datetime.fromisoformat(timestamp)

                    if data.date() == hoje:
                        today_detections += 1

                except Exception:
                    pass

        elif doc.get("type") == "user":

            total_users += 1

    return {
        "totalDetections": total_detections,
        "totalUsers": total_users,
        "todayDetections": today_detections
    }

@app.get("/latest")
def latest():

    result = []

    for doc_id in db:

        doc = db[doc_id]

        if doc.get("type") == "detection":

            result.append({

                "person": doc.get("person"),
                "timestamp": doc.get("timestamp")

            })

    result.sort(
        key=lambda x: x["timestamp"],
        reverse=True
    )

    return result[:10]

@app.get("/video_feed")
def video_feed():

    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
