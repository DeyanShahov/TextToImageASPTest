namespace TextToImageASPTest.Services
{
    public class AppSettings
    {
        private static List<Dictionary<string, object>> modelsSettings = new List<Dictionary<string, object>>
        {
            new Dictionary<string, object>
            {
                { "ModelName", "aniversePonyXL_v40.safetensors" },
                { "Steps", 20 },
                { "Cfg", 6 },
                { "SamplerName", "euler" },
                { "Scheduler", "normal" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "" }
            },
            new Dictionary<string, object>
            {
                { "ModelName", "aniversePonyXL_v50.safetensors" },
                { "Steps", 30 },
                { "Cfg", 5 },
                { "SamplerName", "euler" },
                { "Scheduler", "karras" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "more details, " },
                { "NegativePrompts", "worst quality:1.4, low quality:1.4, grayscale, doll, plastic, fake, ugly, hair on face, muscolar woman, low res, blurry, fat" }
            },
            new Dictionary<string, object>
            {
                { "ModelName", "epicrealism_pureEvolutionV5-inpainting.safetensors" },
                { "Steps", 30 },
                { "Cfg", 6 },
                { "SamplerName", "euler" },
                { "Scheduler", "normal" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "cartoon, painting, illustration, (worst quality, low quality, normal quality:2)" }
            },
            new Dictionary<string, object>
            {
                { "ModelName", "Juggernaut-X-RunDiffusion-NSFW.safetensors" },
                { "Steps", 30 },
                { "Cfg", 6 },
                { "SamplerName", "euler" },
                { "Scheduler", "karras" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "fake eyes, deformed eyes, bad eyes, cgi, 3D, digital, airbrushed, cartoon, painting, illustration, (worst quality, low quality, normal quality:2)" }
            },
            new Dictionary<string, object>
            {
                { "ModelName", "lazymixRealAmateur_v40Inpainting.safetensors" },
                { "Steps", 30 },
                { "Cfg", 6 },
                { "SamplerName", "euler" },
                { "Scheduler", "karras" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "fake eyes, deformed eyes, bad eyes, cgi, 3D, digital, airbrushed, cartoon, painting, illustration, (worst quality, low quality, normal quality:2)" }
            },
            new Dictionary<string, object>
            {
                { "ModelName", "nsfw_v10.safetensors" },
                { "Steps", 30 },
                { "Cfg", 7 },
                { "SamplerName", "euler" },
                { "Scheduler", "karras" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "fake eyes, deformed eyes, bad eyes, cgi, 3D, digital, airbrushed, cartoon, painting, illustration, (worst quality, low quality, normal quality:2)" }
            },
            new Dictionary<string, object>
            {
                { "ModelName", "uberRealisticPornMerge_v23Final.safetensors" },
                { "Steps", 30 },
                { "Cfg", 8 },
                { "SamplerName", "euler" },
                { "Scheduler", "karras" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "fake eyes, deformed eyes, bad eyes, cgi, 3D, digital, airbrushed, cartoon, painting, illustration, (worst quality, low quality, normal quality:2)" }
            },
            //new Dictionary<string, object>
            //{
            //    { "ModelName", "waiNSFWIllustrious_v130.safetensors" },
            //    { "Steps", 20 },
            //    { "Cfg", 7.0 },
            //    { "SamplerName", "euler" },
            //    { "Scheduler", "karras" },
            //    { "Denoise", 1.00 },
            //    { "PositivePrompts", "" },
            //    { "NegativePrompts", "" }
            //},
            new Dictionary<string, object>
            {
                { "ModelName", "duchaitenReal3dNSFW_v10.safetensors" },
                { "Steps", 30 },
                { "Cfg", 7 },
                { "SamplerName", "euler" },
                { "Scheduler", "karras" },
                { "Denoise", 1.00 },
                { "PositivePrompts", "" },
                { "NegativePrompts", "illustration, 3d, 2d, painting, cartoons, sketch, (worst quality:1.9), (low quality:1.9), (normal quality:1.9), lowres, bad anatomy, bad hands, vaginas in breasts, ((monochrome)), ((grayscale)), collapsed eyeshadow, multiple eyebrow, (cropped), oversaturated, extra limb, missing limbs, deformed hands, long neck, long body, imperfect, (bad hands), signature, watermark, username, artist name, conjoined fingers, deformed fingers, ugly eyes, imperfect eyes, skewed eyes, unnatural face, unnatural body, error, bad image, bad photo" }
            },
        };

        //public static readonly string SystemNegativePrompt2 = "score_6, score_5, score_4, text, watermark, worst quality, low quality, front light, doll, plastic, fake, ugly, low res, blurry, fat, extra fingers,distorted hands,distorted fingers, muscular, bad anatomy,signature,lineless, easynegative, moir pattern, downsampling, aliasing, distorted, glossy, blur, jpeg artifacts, compression artifacts, poorly drawn, low-resolution, bad, distortion, twisted, excessive, exaggerated pose, exaggerated limbs, mixed characters, grainy, symmetrical, duplicate, error, pattern, beginner, pixelated, fake, hyper, glitch, overexposed, high-contrast, bad-contrast, black and white, messy, Deformed, Deformed face, Deformed fingers, Deformed hands, Out of frame, Poorly drawn face, Poorly drawn feet, Poorly drawn hands, Draft, Grainy, Kitsch, Low-res, old, doujinshi, exaggerated anatomy, long neck, bad hands, bad eyes, bad face, bad body, bad hair, bad skin, bad lighting, bad composition, bad perspective, bad proportions, bad colors, bad shading, bad texture, bad details, low quality, low resolution";
        //public static readonly string SystemNegativePrompt = "score_6, score_5, score_4, text, watermark, worst quality, low quality, front light, doll, plastic, fake, blurry, muscular, extra fingers, distorted hands, distorted fingers, easynegative, aliasing, distorted, glossy, blur, jpeg artifacts, compression artifacts, poorly drawn, low-resolution, excessive, exaggerated pose, exaggerated limbs, mixed characters, symmetrical, pattern, beginner, pixelated, high-contrast, bad-contrast, Deformed, Deformed face, Deformed fingers, Deformed hands, Out of frame, doujinshi, exaggerated anatomy, long neck, bad hands, bad eyes, bad face, bad body, bad hair, bad skin, bad lighting, bad composition, bad perspective, bad proportions, bad shading, bad texture, bad details";

        public static readonly string SystemNegativePrompt = "score_6, score_5, score_4, text, watermark, worst quality, low quality, front light, doll, plastic, fake, ugly, low res, fat, extra fingers, distorted hands, distorted fingers, bad anatomy, signature, lineless, easynegative, moir pattern, downsampling, aliasing, distorted, glossy, jpeg artifacts, compression artifacts, distortion, twisted, excessive, exaggerated pose, exaggerated limbs, mixed characters, grainy, symmetrical, duplicate, error, pattern, pixelated, glitch, overexposed, bad-contrast, messy, Deformed, Deformed face, Deformed fingers, Deformed hands, Out of frame, Poorly drawn hands, Draft, Grainy, Low-res, exaggerated anatomy, long neck, bad hands";

        public static readonly string SystemPositivePromptPrefix = "score_9, score_8_up, score_7_up, 4n1v3rs3, ";

        // public static readonly string SystemPositivePromptSufix2 = ", masterpiece, best quality, high quality, 8k, 4k, ultra-detailed, ultra-realistic, realistic, detailed, intricate, beautiful, gorgeous, stunning, breathtaking, lifelike, hyper-realistic, natural lighting, dynamic pose, expressive pose, dynamic angle, depth of field, sharp"; 
        // public static readonly string SystemPositivePromptSufix2 = ", high quality, detailed, natural lighting, dynamic pose, dynamic angle, depth of field, sharp"; 
        public static readonly string SystemPositivePromptSufix = ""; 
        private static int currentStyleIndex = 1; // Index of the current style in the array      

        public static int imageCounter = 0; // Counter for the number of images generated
        public static int numberOfImagesBeforeAdd = 5; // Counter for the number of images generated before an ad is shown
        public static bool isAnimeStyle = true; // Flag to check style to set

        public static string ChangeStyle()
        {
            currentStyleIndex++;

            if(currentStyleIndex >= modelsSettings.Count) currentStyleIndex = 0; // Reset to the first style if the end of the array is reached
            
            return GetCurrentStyle();
        }

        public static string GetCurrentStyle()
        {
            return modelsSettings[currentStyleIndex]["ModelName"].ToString(); // Return the current style
        }

        public static Dictionary<string, object> GetCurrentModel() => modelsSettings[currentStyleIndex]; // Return the current mode
    }
}
