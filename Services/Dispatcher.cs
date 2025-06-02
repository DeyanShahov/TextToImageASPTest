using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace TextToImageASPTest.Services
{
    public class Dispatcher
    {
        private static readonly HttpClient httpClient;
        private const string NginxUrl = "http://77.77.134.134:81";
        private const string ApiKey = "redfox-api-key";

        // Static constructor to initialize HttpClient and its default headers
        static Dispatcher()
        {
            httpClient = new HttpClient();
            // As per the requirement: http.DefaultRequestHeaders.Add("Authorization", "redfox-api-key");
            // This adds the header as "Authorization: redfox-api-key"
            httpClient.DefaultRequestHeaders.Add("Authorization", ApiKey);
        }

        public async Task<string> DispatchAsync(string promptText, List<string> style1settings, List<string> style2settings)
        {
            // Prepare the request payload based on Node.js server expectations
            var requestData = new
            {
                // userId is now generated dynamically
                userId =  Guid.NewGuid().ToString(), 
                input_image_prompt = promptText,
                input_image_style1 = style1settings, // Will be serialized as a JSON array
                input_image_style2 = style2settings, // Will be serialized as a JSON array
                input_image_url = (string)null,   // Placeholder for input_image_url
                parameters = new { }              // Placeholder for parameters (empty object)
            };

            string jsonPayload;
            try
            {
                jsonPayload = JsonSerializer.Serialize(requestData);
            }
            catch (JsonException e)
            {
                Debug.WriteLine($"JSON serialization error: {e.Message}");
                return e.Message; // Exit if payload cannot be created
            }

            HttpContent content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            try
            {
                // HttpClient is already configured with the Authorization header via the static constructor
                HttpResponseMessage response = await httpClient.PostAsync(NginxUrl, content);

                // Read the response content
                string responseBody = await response.Content.ReadAsStringAsync();

                // "съхранява в параметър" - responseBody now holds the result.
                // "отпечатан в дебуг конзолата" - printing to debug console.
                if (response.IsSuccessStatusCode)
                {
                    Debug.WriteLine("Request successful. Response from Node.js server:");
                    Debug.WriteLine($"Status Code: {response.StatusCode}");
                    Debug.WriteLine($"Response Body: {responseBody}");
                    return responseBody;
                }
                else
                {
                    Debug.WriteLine($"Request failed.");
                    Debug.WriteLine($"Status Code: {response.StatusCode}");
                    Debug.WriteLine($"Response Body: {responseBody}");
                    return responseBody;

                }
            }
            catch (HttpRequestException e)
            {
                Debug.WriteLine($"Request error: {e.Message}{(e.InnerException != null ? $", Inner Exception: {e.InnerException.Message}" : "")}");
                return e.Message;
            }
            catch (Exception e) // Catch-all for other unexpected errors
            {
                Debug.WriteLine($"An unexpected error occurred: {e.Message}");
                return e.Message;
            }
        }
    }
}
