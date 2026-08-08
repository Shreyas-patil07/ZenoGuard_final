# Premium Prediction

A machine learning model that predicts insurance premiums for gig workers (delivery, ride-hailing, courier, and quick commerce) based on risk factors and work patterns.

## Files

| File | Description |
|------|-------------|
| `premium_predictor.py` | Inference module — loads the trained model and exposes `predict_premium()` |
| `premium_training_data.csv` | Training dataset with gig worker features and recommended premiums |
| `test_premium.py` | Sample usage script for testing the predictor |
| `models/premium_model.pkl` | Serialized trained model |

## Usage

```python
from premium_predictor import predict_premium

worker = {
    "platform": "Swiggy",
    "worker_type": "Delivery",
    "location": "Mumbai",
    "age": 24,
    "experience_months": 18,
    "working_hours": 8,
    "daily_income": 1200,
    "avg_daily_distance_km": 85,
    "weather_risk": 0.70,
    "traffic_risk": 0.65,
    "area_risk": 0.60,
    "night_work_ratio": 0.30,
    "historical_incidents": 1,
    "safety_score": 0.75,
    "days_active_last_30": 25,
    "previous_claims": 0,
    "avg_trip_duration_min": 28
}

premium = predict_premium(worker)
print("Recommended Premium:", premium)
```

## Features Used

- **Worker profile**: platform, worker type, location, age, experience
- **Work patterns**: working hours, daily income, distance, days active
- **Risk factors**: weather risk, traffic risk, area risk, night work ratio
- **History**: historical incidents, safety score, previous claims, avg trip duration
