namespace TextToImageASPTest.Services
{
    public class CreatePortrait
    {
        private static Random random = new Random();

        // Данните от JSON файла, вградени директно като речник
        private static readonly Dictionary<string, List<string>> portraitData = new Dictionary<string, List<string>>
        {
            { "beard_list", new List<string> { "Stubble Beard", "Goatee", "Full Beard", "Van Dyke Beard", "Soul Patch", "Garibaldi Beard", "Mutton Chops", "Circle Beard", "Corporate Beard", "Balbo Beard", "Ducktail Beard", "Chinstrap Beard", "Anchor Beard", "Chevron Mustache", "Horseshoe Mustache", "Handlebar Mustache", "Imperial Mustache", "Pencil Mustache", "Friendly Mutton Chops", "Zappa Mustache" } },
            { "body_type_list", new List<string> { "Underweight", "Normal weight", "Overweight", "Obese" } },
            { "eyes_color_list", new List<string> { "Brown", "Blue", "Green", "Hazel", "Gray", "Amber", "Red", "Violet" } },
            { "face_expression_list", new List<string> { "Happy", "Sad", "Angry", "Surprised", "Fearful", "Disgusted", "Contemptuous", "Excited", "Nervous", "Confused", "Amused", "Content", "Disappointed", "Bored", "Relieved", "In love", "Shy", "Envious", "Proud", "Cautious", "Serious", "Serene", "Peaceful", "Calm" } },
            { "face_shape_list", new List<string> { "Oval", "Round", "Square", "Heart-shaped", "Long", "Rectangle", "Triangle", "Inverted Triangle", "Pear-shaped", "Oblong", "Square Round", "Square Oval" } },
            { "gender_list", new List<string> { "Man", "Woman" } },
            { "hair_color_list", new List<string> { "Black", "Brown", "Blonde", "Red", "Auburn", "Chestnut", "Gray", "White", "Salt and pepper" } },
            { "hair_style_list", new List<string> { "Asymmetrical cut", "Blunt cut", "Bob cut", "Braided bob", "Buzz cut", "Choppy cut", "Curly bob", "Curtain bangs", "Faux hawk", "Feathered cut", "French bob", "Layered cut", "Long bob", "Mohawk", "Pixie cut", "Shag cut", "Side-swept bangs", "Textured cut", "Undercut", "Wavy bob", "Faux hawk short pixie", "Brave short haircut with shaved sides", "Tapered haricut wuth shaved side", "Stacked bob", "Lemonade braids", "Middle part ponytails", "Stitch braids", "Deep side part", "French braids", "Box braids", "Two dutch braids", "Wavy cut with curtains bangs", "Right side shaved", "Sweeping pixie", "Smooth lob", "Long pixie", "Sideswept pixie", "Italian bob", "Shullet" } },
            { "light_direction_list", new List<string> { "top", "bottom", "right", "left", "front", "rear", "top-right", "top-left", "bottom-right", "bottom-left" } },
            { "light_type_list", new List<string> { "Natural sunlight", "Soft ambient light", "Harsh sunlight", "Overcast sky", "Sunset glow", "Sunrise warmth", "Twilight hues", "Candlelight", "Incandescent lighting", "Fluorescent lighting", "Moonlight", "Dappled sunlight", "Backlit silhouette", "Spotlight", "Rim lighting", "Firelight", "City streetlights", "Studio lighting", "Lantern light", "Tungsten lighting", "Cloudy day diffused light", "Skylight", "Golden hour light", "Blue hour light", "Flash photography", "Stage lighting", "Neon lights", "Torchlight", "Softbox lighting", "Rim light", "Lightning", "Abstract light patterns" } },
            { "model_pose_list", new List<string> { "Power Pose", "Walking Pose", "The Over-the-Shoulder Look", "S-curve Pose", "Sitting Pose", "Close-Up Beauty Shot Pose", "Leaning Pose", "Arms Up Pose", "Casual Stroll Pose", "Headshot Pose", "Sitting Cross-Legged Pose", "Back Arch Pose", "Hand-on-Hip Pose", "Gazing into the Distance Pose", "Candid Laugh Pose", "Dynamic Action Pose", "Contrapposto Pose", "High Fashion Pose" } },
            { "nationality_list", new List<string> { "Afghan", "Albanian", "Algerian", "Andorran", "Angolan", "Antiguans Barbudans", "Argentine", "Armenian", "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian Herzegovinian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burundian", "Cambodian", "Cameroonian", "Canadian", "Cape Verdian", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djibouti", "Dominican", "Dutch", "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian", "Herzegovinian", "Honduran", "Hungarian", "Icelander", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Kiribati", "North Korean", "South Korean", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monegasque", "Mongolian", "Montenegrin", "Moroccan", "Mosotho", "Motswana", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Ni-Vanuatu", "Nicaraguan", "Nigerian", "Nigerien", "North Korean", "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Palestinian", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean", "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian", "Slovenian", "Solomon Islander", "Somali", "South African", "South Korean", "South Sudanese", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Swiss", "Syrian", "Tajikistani", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian Tobagonian", "Tunisian", "Turkish", "Turkmen", "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Welsh", "Yemeni", "Zambian", "Zimbabwean" } },
            { "shot_list", new List<string> { "Head portrait", "Head and shoulders portrait", "Half-length portrait", "Full-length portrait", "Face", "Portrait", "Full body", "Close-up" } }
        };

        public static string GeneratePortraitPrompt()
        {
            // Избираме произволен пол
            string gender = GetRandomItem(portraitData["gender_list"]);

            // Списък за съхранение на избраните характеристики
            List<string> portraitTraits = new List<string>();
            portraitTraits.Add(gender);

            // Избираме националност
            portraitTraits.Add(GetRandomItem(portraitData["nationality_list"]));

            // Избираме тип тяло
            portraitTraits.Add(GetRandomItem(portraitData["body_type_list"]));

            // Избираме форма на лицето
            portraitTraits.Add($"with {GetRandomItem(portraitData["face_shape_list"])} face");

            // Избираме цвят на очите
            portraitTraits.Add($"with {GetRandomItem(portraitData["eyes_color_list"])} eyes");

            // Избираме прическа и цвят на косата
            string hairColor = GetRandomItem(portraitData["hair_color_list"]);
            string hairStyle = GetRandomItem(portraitData["hair_style_list"]);
            portraitTraits.Add($"with {hairColor} {hairStyle}");

            // Избираме изражение на лицето
            portraitTraits.Add($"with {GetRandomItem(portraitData["face_expression_list"])} expression");

            // Ако полът е мъж, добавяме брада (50% шанс)
            if (gender == "Man" && random.Next(2) == 0)
            {
                portraitTraits.Add($"with {GetRandomItem(portraitData["beard_list"])}");
            }

            // Избираме поза
            portraitTraits.Add($"in {GetRandomItem(portraitData["model_pose_list"])}");

            // Избираме тип кадър
            portraitTraits.Add($"{GetRandomItem(portraitData["shot_list"])}");

            // Избираме осветление
            string lightType = GetRandomItem(portraitData["light_type_list"]);
            string lightDirection = GetRandomItem(portraitData["light_direction_list"]);
            portraitTraits.Add($"with {lightType} from {lightDirection}");

            // Създаваме финалното описание
            string portraitDescription = string.Join(", ", portraitTraits);

            return portraitDescription;
        }

        private static string GetRandomItem(List<string> list)
        {
            int count = list.Count;
            if (count == 0)
            {
                // Обработка на случай с празен списък, ако е възможно
                return string.Empty; // Или хвърляне на изключение
            }
            int index = random.Next(count);
            return list[index];
        }
    }
}
