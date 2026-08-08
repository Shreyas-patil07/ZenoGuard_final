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