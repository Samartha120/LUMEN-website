# LUMEN AI Service

Computer-vision microservice powering the intelligent features of the LUMEN
civic platform. FastAPI + YOLO (Ultralytics) + OpenCV.

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --port 8100 --reload
```

Health check: <http://localhost:8100/health> · Docs: <http://localhost:8100/docs>

## Endpoints

| Method | Path | Purpose | Feature |
|---|---|---|---|
| GET | `/health` | Service status and which model is loaded | — |
| POST | `/detect` | Detect + classify road damage, score severity, return annotated image | 1, 2 |
| POST | `/embed` | Perceptual embedding of an image | 3 |
| POST | `/compare` | Cosine similarity between two embeddings | 3 |
| POST | `/verify` | Before/after repair verification | 4 |

## Model modes

The service reports `model_mode` on every response:

- **`TRAINED`** — `weights/rdd_best.pt` present; fine-tuned on RDD2022, detects
  the four road-damage classes (longitudinal crack, transverse crack,
  alligator crack, pothole).
- **`FALLBACK`** — no fine-tuned weights; a pretrained COCO YOLO is loaded so
  the pipeline runs end-to-end. **Detections are generic objects, not road
  damage.** Train to get real results.

## Training on RDD2022

RDD2022 is the multi-national road damage dataset (47,420 images, 55,000+
annotated instances across 6 countries including India), released through the
Crowdsensing-Based Road Damage Detection Challenge.

- Paper: <https://arxiv.org/abs/2209.08538>
- Journal: <https://rmets.onlinelibrary.wiley.com/doi/10.1002/gdj3.260>
- Download: <https://figshare.com/articles/dataset/RDD2022_-_The_multi-national_Road_Damage_Dataset_released_through_CRDDC_2022/21431547>

```bash
# 1. Extract the India subset to ai-service/data/RDD2022/India
# 2. Convert VOC XML annotations to YOLO format
python train.py --convert --root data/RDD2022/India

# 3. Fine-tune (uses Apple Silicon MPS automatically)
python train.py --train --epochs 50
```

Training copies the best checkpoint to `weights/rdd_best.pt` and prints
mAP50-95, mAP50, precision and recall — the numbers for your results chapter.

## Algorithms

- **Detection** — YOLO single-stage CNN detector, transfer-learned from
  pretrained weights onto the RDD2022 classes.
- **Severity scoring** — weighted sum over detections of
  `class_weight × √(area_ratio) × confidence`, plus a multi-instance bonus,
  mapped to LOW/MEDIUM/HIGH/CRITICAL bands. The square root prevents one large
  detection from saturating the scale.
- **Duplicate embedding** — 512-D ImageNet-pretrained ResNet-18 pooled CNN
  features, L2-normalised; compared by cosine similarity and constrained by
  Haversine distance and a time window in the web app. Hand-crafted descriptors
  (perceptual hash + HSV histogram) were implemented first and measured:
  unrelated desaturated road scenes scored cosine > 0.98, so they were replaced
  by CNN features, which separate same-scene (~0.97) from different-scene
  (~0.52–0.63) reliably.
- **Repair verification** — re-runs detection on the after-image and compares
  severity reduction, with global SSIM as a guard against an engineer
  resubmitting the same photograph.
