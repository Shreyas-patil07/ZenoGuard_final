import cv2
import math
import cvzone
from ultralytics import YOLO

# Load YOLO model with custom weights
yolo_model = YOLO("Weights/best.pt")

# Define class names
class_labels = [
    "Bodypanel-Dent", "Front-Windscreen-Damage", "Headlight-Damage",
    "Rear-windscreen-Damage", "RunningBoard-Dent", "Sidemirror-Damage",
    "Signlight-Damage", "Taillight-Damage", "bonnet-dent", "boot-dent",
    "doorouter-dent", "fender-dent", "front-bumper-dent", "pillar-dent",
    "quaterpanel-dent", "rear-bumper-dent", "roof-dent"
]

# Load the image
image_path = "Media/dent_1.jpg"
img = cv2.imread(image_path)

if img is None:
    raise FileNotFoundError(f"Image not found: {image_path}")

# Perform object detection
results = yolo_model(img)

# Loop through the detections and draw bounding boxes
for r in results:
    boxes = r.boxes
    for box in boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        w, h = x2 - x1, y2 - y1
        conf = math.ceil((box.conf[0] * 100)) / 100
        cls = int(box.cls[0])

        if conf > 0.3:
            cvzone.cornerRect(img, (x1, y1, w, h), t=2)
            cvzone.putTextRect(
                img,
                f"{class_labels[cls]} {conf}",
                (x1, y1 - 10),
                scale=0.8,
                thickness=1,
                colorR=(255, 0, 0)
            )

# Display the image with detections
cv2.imshow("Image", img)

# Close window when 'q' is pressed
while True:
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()
cv2.waitKey(1)