import cv2
import math
import numpy as np
import mediapipe as mp
import couchdb
import requests
import time


def open_camera(index=0):
    cap = cv2.VideoCapture(index)
    if cap.isOpened():
        return cap

    cap.release()
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if cap.isOpened():
        return cap

    cap.release()
    cap = cv2.VideoCapture(index, cv2.CAP_MSMF)
    return cap

camera = open_camera(0)

last_frame = None

COUCH_URL = "http://admin:admin@127.0.0.1:5984/"
DB_NAME = "facial"

server = couchdb.Server(COUCH_URL)
db = server[DB_NAME]

API_URL = "http://127.0.0.1:8000/detection"

mp_face_mesh = mp.solutions.face_mesh

ACTIVE_USERS = {}
LAST_FACE_TIME = {}

ABSENCE_TIMEOUT = 20

def save_detection(person):

    try:

        requests.post(
            f"{API_URL}/{person}",
            timeout=2
        )

        print(f"DETECAO GUARDADA: {person}")

    except Exception as e:

        print("ERRO API:", e)

def load_users():

    users = []

    for doc_id in db:

        doc = db[doc_id]

        if doc.get("type") != "user":
            continue

        if "landmarks" not in doc:
            continue

        users.append({

            "name": doc["name"],
            "landmarks": doc["landmarks"]

        })

    return users

def compare_faces(current, saved):

    total = 0

    points = min(
        len(current),
        len(saved)
    )

    for i in range(points):

        dx = current[i]["x"] - saved[i]["x"]
        dy = current[i]["y"] - saved[i]["y"]

        total += (dx * dx + dy * dy)

    return total / points

def generate_frames():

    global last_frame
    global camera

    if not camera.isOpened():
        camera = open_camera(0)

    users = load_users()

    print("UTILIZADORES CARREGADOS:")
    print([u["name"] for u in users])

    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True
    ) as face_mesh:

        while True:

            success, frame = camera.read()

            if not success:
                continue

            last_frame = frame.copy()

            rgb = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            results = face_mesh.process(rgb)

            current_time = time.time()

            expired = []

            for person in ACTIVE_USERS:

                last_seen = LAST_FACE_TIME.get(
                    person,
                    0
                )

                if current_time - last_seen > ABSENCE_TIMEOUT:

                    expired.append(person)

            for person in expired:

                del ACTIVE_USERS[person]

                if person in LAST_FACE_TIME:

                    del LAST_FACE_TIME[person]

                print(f"{person} saiu")

            if results.multi_face_landmarks:

                face = results.multi_face_landmarks[0]

                current = []

                xs = []
                ys = []

                for idx, lm in enumerate(face.landmark):

                    current.append({

                        "id": idx,
                        "x": float(lm.x),
                        "y": float(lm.y)

                    })

                    xs.append(
                        int(lm.x * frame.shape[1])
                    )

                    ys.append(
                        int(lm.y * frame.shape[0])
                    )

                best_name = "Unknown"
                best_score = 999999

                for user in users:

                    score = compare_faces(
                        current,
                        user["landmarks"]
                    )

                    if score < best_score:

                        best_score = score
                        best_name = user["name"]

                if best_score > 0.003:

                    best_name = "Unknown"

                if best_name != "Unknown":

                    LAST_FACE_TIME[
                        best_name
                    ] = current_time

                    if best_name not in ACTIVE_USERS:

                        ACTIVE_USERS[
                            best_name
                        ] = True

                        print(
                            f"{best_name} entrou"
                        )

                        save_detection(
                            best_name
                        )

                x1 = min(xs)
                y1 = min(ys)

                x2 = max(xs)
                y2 = max(ys)

                padding = 20
                x1 = max(0, x1 - padding)
                y1 = max(0, y1 - padding)
                x2 = min(frame.shape[1] - 1, x2 + padding)
                y2 = min(frame.shape[0] - 1, y2 + padding)

                corner_radius = min(40, (x2 - x1) // 4, (y2 - y1) // 4)
                thickness = 10
                color = (255, 255, 255)

                dash_length = 36
                gap_length = 18

                def draw_single_side_dash():
                    half = dash_length // 2
                    # top/bottom horizontal dash
                    left = x1 + corner_radius
                    right = x2 - corner_radius
                    cx = (left + right) // 2
                    x_start = max(left, cx - half)
                    x_end = min(right, cx + half)
                    cv2.line(frame, (x_start, y1), (x_end, y1), color, thickness, cv2.LINE_AA)
                    cv2.line(frame, (x_start, y2), (x_end, y2), color, thickness, cv2.LINE_AA)

                    top = y1 + corner_radius
                    bottom = y2 - corner_radius
                    cy = (top + bottom) // 2
                    y_start = max(top, cy - half)
                    y_end = min(bottom, cy + half)
                    cv2.line(frame, (x1, y_start), (x1, y_end), color, thickness, cv2.LINE_AA)
                    cv2.line(frame, (x2, y_start), (x2, y_end), color, thickness, cv2.LINE_AA)

                def draw_single_corner_arcs():
                    arc_span = int((dash_length / max(1, corner_radius)) * 180.0 / math.pi)
                    arc_span = max(4, min(90, arc_span))
                    half_gap = (90 - arc_span) / 2.0
                    start = int(180 + half_gap)
                    end = int(start + arc_span)
                    cv2.ellipse(frame, (x1 + corner_radius, y1 + corner_radius), (corner_radius, corner_radius), 0, start, end, color, thickness, cv2.LINE_AA)
                    start = int(270 + half_gap)
                    end = int(start + arc_span)
                    cv2.ellipse(frame, (x2 - corner_radius, y1 + corner_radius), (corner_radius, corner_radius), 0, start, end, color, thickness, cv2.LINE_AA)
                    start = int(0 + half_gap)
                    end = int(start + arc_span)
                    cv2.ellipse(frame, (x2 - corner_radius, y2 - corner_radius), (corner_radius, corner_radius), 0, start, end, color, thickness, cv2.LINE_AA)
                    start = int(90 + half_gap)
                    end = int(start + arc_span)
                    cv2.ellipse(frame, (x1 + corner_radius, y2 - corner_radius), (corner_radius, corner_radius), 0, start, end, color, thickness, cv2.LINE_AA)

                draw_single_side_dash()
                draw_single_corner_arcs()

                label = f"{best_name}"
                y_offset = 22

                try:
                    from PIL import Image, ImageDraw, ImageFont
                    import os

                    candidates = [
                        os.path.join('frontend', 'src', 'Montserrat-Regular.ttf'),
                        os.path.join('frontend', 'src', 'Montserrat.ttf'),
                        os.path.join('fonts', 'Montserrat-Regular.ttf'),
                        os.path.join('fonts', 'Montserrat.ttf'),
                        os.path.join('c:', 'Windows', 'Fonts', 'Montserrat-Regular.ttf'),
                        os.path.join('c:', 'Windows', 'Fonts', 'Montserrat.ttf'),
                        '/usr/share/fonts/truetype/montserrat/Montserrat-Regular.ttf',
                        '/usr/share/fonts/truetype/montserrat/Montserrat.ttf'
                    ]

                    font_path = None
                    for p in candidates:
                        if os.path.exists(p):
                            font_path = p
                            break

                    font_size = max(16, int((y2 - y1) * 0.08))

                    if font_path:
                        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                        draw = ImageDraw.Draw(img)
                        font = ImageFont.truetype(font_path, font_size)
                        text_w, text_h = draw.textsize(label, font=font)
                        text_x = x1 + ((x2 - x1) - text_w) // 2
                        text_y = max(int(y1 - y_offset), 0)
                        outline_color = (0, 0, 0)
                        for ox, oy in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
                            draw.text((text_x + ox, text_y + oy), label, font=font, fill=outline_color)
                        draw.text((text_x, text_y), label, font=font, fill=(255, 255, 255))
                        frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                    else:
                        font_scale = 1
                        text_thickness = 2
                        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_thickness)
                        text_x = x1 + ((x2 - x1) - text_w) // 2
                        text_y = max(text_h + 5, y1 - y_offset)
                        cv2.putText(
                            frame,
                            label,
                            (text_x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            font_scale,
                            color,
                            text_thickness,
                            cv2.LINE_AA
                        )
                except Exception:
                    font_scale = 1
                    text_thickness = 2
                    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_thickness)
                    text_x = x1 + ((x2 - x1) - text_w) // 2
                    text_y = max(text_h + 5, y1 - y_offset)
                    cv2.putText(
                        frame,
                        label,
                        (text_x, text_y),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        font_scale,
                        color,
                        text_thickness,
                        cv2.LINE_AA
                    )

            ret, buffer = cv2.imencode(
                ".jpg",
                frame
            )

            if not ret:
                continue

            frame_bytes = buffer.tobytes()

            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n'
                + frame_bytes +
                b'\r\n'
            )