import cv2
import numpy as np
import model as M

images = {
    "CMP-10258 (leaves)": "../uploads/citizen-9ff23da4-9537-4e87-9c93-0380d817e5bf.jpg",
    "CMP-10319 (puddle)": "../uploads/citizen-28d2c2b4-c910-4fcd-bf92-779259d0aa2e.jpeg"
}

for name, img_path in images.items():
    img = cv2.imread(img_path)
    with open(img_path, "rb") as f:
        data = f.read()
    res = M.detect(data, conf=0.50)
    
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 70, 180)
    
    filtered_dets = []
    for d_dict in res["detections"]:
        label = d_dict["label"]
        poly = d_dict.get("polygon")
        
        if label == "Pothole" and poly is not None:
            mask = np.zeros((h, w), dtype=np.uint8)
            pts = np.array(poly, dtype=np.int32)
            cv2.fillPoly(mask, [pts], 255)
            edges_inside = cv2.bitwise_and(edges, mask)
            mask_area = float((mask > 0).sum())
            if mask_area > 0:
                edge_density = float((edges_inside > 0).sum()) / mask_area
                print(f"{name} Pothole edge density: {edge_density:.4f}")
                if edge_density > 0.20:
                    continue
        filtered_dets.append(d_dict)
        
    print(f"Final Detections for {name}:", [d["label"] for d in filtered_dets])
