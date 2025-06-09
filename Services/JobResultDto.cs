using System.Text.Json.Serialization;

namespace TextToImageASPTest.Services
{
    public class JobResultDto
    {
        [JsonPropertyName("status")]
        public string Status { get; set; }

        [JsonPropertyName("image_data_base64")]
        public string ImageDataBase64 { get; set; }

        [JsonPropertyName("image_type")]
        public string ImageType { get; set; }
    }
}