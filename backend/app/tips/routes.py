# app/tips/routes.py
from flask import jsonify
from app.tips import bp
import requests
import os
import random
from dotenv import load_dotenv

load_dotenv()  

@bp.route("/tip-of-the-day", methods=["GET"])
def tip_of_the_day():
    try:
        api_key = os.environ.get("PERENUAL_KEY")
        if not api_key:
            return jsonify({"tip": "API key not found."}), 500

        url = f"https://perenual.com/api/species-care-guide-list?key={api_key}&limit=50"
        response = requests.get(url)
        data = response.json()
        plant_list = data.get("data", [])

        if not plant_list:
            return jsonify({"tip": "No tips available at the moment."})

        random.shuffle(plant_list)

        for plant in plant_list:
            sections = plant.get("section", [])
            if sections:
                section = random.choice(sections)
                description = section["description"]
                first_line = description.split(".")[0] + "."
                return jsonify({
                    "firstLine": first_line,
                    "fullDescription": description,  
                    "speciesId": plant["species_id"]
                })

        return jsonify({"tip": "No tips available for these plants."})

    except Exception as e:
        print(e)
        return jsonify({"tip": "Unable to fetch tip for today."})
