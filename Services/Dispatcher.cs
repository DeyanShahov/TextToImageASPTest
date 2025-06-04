using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace TextToImageASPTest.Services
{
    public class Dispatcher
    {
        private static readonly HttpClient httpClient;
        private const string NginxSendJobUrl = "http://77.77.134.134:81/jobSend";
        private const string NginxResultJobUrl = "http://77.77.134.134:81/jobResult"; // New endpoint for polling
        private const string ApiKey = "redfox-api-key";
        private const int PollingIntervalSeconds = 5;
        // PollingTimeoutSeconds is now handled within PollJobResultAsync
        private const int PollingTimeoutSeconds = 60; // Overall timeout for polling

        // Static constructor to initialize HttpClient and its default headers
        static Dispatcher()
        {
            httpClient = new HttpClient();
            // As per the requirement: http.DefaultRequestHeaders.Add("Authorization", "redfox-api-key");
            // This adds the header as "Authorization: redfox-api-key"
            httpClient.DefaultRequestHeaders.Add("Authorization", ApiKey);
        }

        /// <summary>
        /// Sends the initial job request to the jobSend endpoint.
        /// </summary>
        /// <param name="promptText">The main text prompt for the image.</param>
        /// <param name="style1settings">List of style settings for style 1.</param>
        /// <param name="style2settings">List of style settings for style 2.</param>
        /// <param name="cancellationToken">Cancellation token to cancel the operation.</param>
        /// <returns>The jobId string received from the server.</returns>
        /// <exception cref="JsonException">Thrown if serialization or deserialization fails.</exception>
        /// <exception cref="HttpRequestException">Thrown if the HTTP request fails.</exception>
        /// <exception cref="OperationCanceledException">Thrown if the operation is cancelled.</exception>
        /// <exception cref="Exception">Thrown for other unexpected errors.</exception>
        /// <exception cref="InvalidOperationException">Thrown if the server response is missing the jobId.</exception>
        private async Task<string> SendJobAsync(string promptText, List<string> style1settings, List<string> style2settings, CancellationToken cancellationToken)
        {
            // Prepare the request payload for jobSend
            var sendJobRequestData = new
            {
                userId = Guid.NewGuid().ToString(),
                input_image_prompt = promptText,
                input_image_style1 = style1settings, // Will be serialized as a JSON array
                input_image_style2 = style2settings, // Will be serialized as a JSON array
                input_image_url = (string)null,   // Placeholder for input_image_url
                parameters = new { }              // Placeholder for parameters (empty object)
            };

            string jsonPayload;
            try
            {
                jsonPayload = JsonSerializer.Serialize(sendJobRequestData);
            }
            catch (JsonException e)
            {
                Debug.WriteLine($"JSON serialization error for jobSend: {e.Message}");
                throw new JsonException($"Failed to serialize jobSend request data: {e.Message}", e);
            }

            HttpContent content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            // HttpClient is already configured with the Authorization header via the static constructor
            Debug.WriteLine($"Sending job request to {NginxSendJobUrl}");
            HttpResponseMessage sendJobResponse = await httpClient.PostAsync(NginxSendJobUrl, content, cancellationToken);

            // Read the response content
            string sendJobResponseBody = await sendJobResponse.Content.ReadAsStringAsync(cancellationToken);
            Debug.WriteLine($"jobSend Status Code: {sendJobResponse.StatusCode}");
            Debug.WriteLine($"jobSend Response Body: {sendJobResponseBody}");

            if (sendJobResponse.StatusCode == System.Net.HttpStatusCode.Created) // Assuming 201 Created for success
            {
                // Assuming the response body is a JSON object containing a "jobId" property
                try
                {
                    using (JsonDocument doc = JsonDocument.Parse(sendJobResponseBody))
                    {
                        if (doc.RootElement.TryGetProperty("jobId", out JsonElement jobIdElement))
                        {
                            string jobId = jobIdElement.GetString();
                            Debug.WriteLine($"Job accepted with ID: {jobId}");
                            return jobId;
                        }
                        else
                        {
                            Debug.WriteLine("Job accepted, but 'jobId' not found in response.");
                            throw new InvalidOperationException($"Job accepted, but 'jobId' not found in response body: {sendJobResponseBody}");
                        }
                    }
                }
                catch (JsonException e)
                {
                    Debug.WriteLine($"Failed to parse jobSend response body as JSON: {e.Message}");
                    throw new JsonException($"Failed to parse jobSend response body as JSON: {e.Message}", e);
                }
            }
            else
            {
                // Handle non-success status codes for the initial request
                Debug.WriteLine($"jobSend request failed with status code: {sendJobResponse.StatusCode}. Response body: {sendJobResponseBody}");
                throw new HttpRequestException($"jobSend request failed with status code {sendJobResponse.StatusCode}. Response: {sendJobResponseBody}");
            }
        }

        /// <summary>
        /// Polls the jobResult endpoint for the status of a specific job ID until it's completed or failed, or timeout occurs.
        /// </summary>
        /// <param name="jobId">The ID of the job to poll for.</param>
        /// <param name="cancellationToken">Cancellation token to cancel the polling.</param>
        /// <returns>The final response body string from the jobResult endpoint when the job is completed or failed.</returns>
        /// <exception cref="OperationCanceledException">Thrown if the polling is cancelled or times out.</exception>
        /// <exception cref="HttpRequestException">Thrown if an HTTP request during polling fails.</exception>
        /// <exception cref="JsonException">Thrown if parsing the JSON response fails.</exception>
        /// <exception cref="InvalidOperationException">Thrown if the jobResult response format is unexpected (e.g., missing status).</exception>
        /// <exception cref="Exception">Thrown for other unexpected errors during polling.</exception>
        private async Task<string> PollJobResultAsync(string jobId, CancellationToken cancellationToken)
        {
            Debug.WriteLine($"Starting polling for job ID: {jobId}");

            // Use a separate CancellationTokenSource for the polling timeout, linked to the main token
            using (var pollingCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken))
            {
                pollingCts.CancelAfter(TimeSpan.FromSeconds(PollingTimeoutSeconds));
                CancellationToken linkedToken = pollingCts.Token;

                try
                {
                    while (true)
                    {
                        // Check for cancellation before polling
                        linkedToken.ThrowIfCancellationRequested();

                        // Wait for the polling interval
                        await Task.Delay(TimeSpan.FromSeconds(PollingIntervalSeconds), linkedToken);

                        // Construct the polling URL (assuming GET with jobId query parameter)
                        string pollingUrl = $"{NginxResultJobUrl}?jobId={Uri.EscapeDataString(jobId)}";
                        Debug.WriteLine($"Polling {pollingUrl}");

                        // Send the polling request
                        HttpResponseMessage pollingResponse = await httpClient.GetAsync(pollingUrl, linkedToken);

                        string pollingResponseBody = await pollingResponse.Content.ReadAsStringAsync(linkedToken);
                        Debug.WriteLine($"jobResult Status Code: {pollingResponse.StatusCode}");
                        Debug.WriteLine($"jobResult Response Body: {pollingResponseBody}");

                        if (pollingResponse.IsSuccessStatusCode)
                        {
                            // Assuming the response body is a JSON object like {"success":true,"message":"{...}"}
                            try
                            {
                                using (JsonDocument doc = JsonDocument.Parse(pollingResponseBody))
                                {
                                    // First, check the outer structure
                                    if (doc.RootElement.TryGetProperty("success", out JsonElement successElement) &&
                                        doc.RootElement.TryGetProperty("message", out JsonElement messageElement) &&
                                        messageElement.ValueKind == JsonValueKind.String)
                                    {
                                        bool success = successElement.GetBoolean();
                                        string innerJsonString = messageElement.GetString();

                                        // Then, parse the inner JSON string from the 'message' property
                                        using (JsonDocument innerDoc = JsonDocument.Parse(innerJsonString))
                                        {
                                            if (innerDoc.RootElement.TryGetProperty("status", out JsonElement statusElement))
                                            {
                                                string status = statusElement.GetString();
                                                Debug.WriteLine($"Job status for {jobId}: {status}");

                                                if (status.Equals("completed", StringComparison.OrdinalIgnoreCase) ||
                                                    status.Equals("failed", StringComparison.OrdinalIgnoreCase))
                                                {
                                                    // Job is finished, return the inner JSON string which contains status and image_data_base64 or error details
                                                    Debug.WriteLine($"Job {jobId} finished with status {status}. Returning inner JSON: {innerJsonString}");
                                                    return innerJsonString;
                                                }
                                                // If status is "pending" or other, continue polling
                                            }
                                            else
                                            {
                                                Debug.WriteLine($"jobResult inner response for {jobId} is missing 'status' property: {innerJsonString}");
                                                throw new InvalidOperationException($"jobResult inner response for {jobId} is missing 'status' property: {innerJsonString}");
                                            }
                                        }
                                    } else {
                                        // Ако отговорът не е в очакваната вложена структура {"success": ..., "message": "..."}
                                        // проверяваме дали е по-прост, директен отговор за статус (напр. за "processing", "pending" или просто "failed").
                                        if (doc.RootElement.TryGetProperty("status", out JsonElement directStatusElement))
                                        {
                                            string directStatus = directStatusElement.GetString();
                                            Debug.WriteLine($"Job status for {jobId} (direct from root): {directStatus}");

                                            if (directStatus.Equals("processing", StringComparison.OrdinalIgnoreCase) ||
                                                directStatus.Equals("pending", StringComparison.OrdinalIgnoreCase))
                                            {
                                                // Задачата все още се обработва. Продължаваме с постването.
                                                // Цикълът ще се повтори след забавянето.
                                            }
                                            else if (directStatus.Equals("failed", StringComparison.OrdinalIgnoreCase))
                                            {
                                                // Задачата е неуспешна и сървърът е върнал директен статус.
                                                // Това е крайно състояние.
                                                Debug.WriteLine($"Job {jobId} failed with direct status. Response: {pollingResponseBody}");
                                                return pollingResponseBody; // Връщаме отговора за грешка.
                                            }
                                            else if (directStatus.Equals("completed", StringComparison.OrdinalIgnoreCase))
                                            {
                                                // Задачата е "completed", но в плоска структура. Това е неочаквано, ако се изисква image_data.
                                                // Стандартният "completed" отговор трябва да е вложен, за да включва данните за изображението.
                                                Debug.WriteLine($"Job {jobId} reported 'completed' directly, but expected nested structure with image data: {pollingResponseBody}");
                                                throw new InvalidOperationException($"Job {jobId} reported 'completed' in an unexpected flat format. Expected nested structure with image data. Response: {pollingResponseBody}");
                                            }
                                            else
                                            {
                                                // Намерена е непозната стойност за статус директно в root елемента.
                                                Debug.WriteLine($"jobResult response for {jobId} has an unknown direct status '{directStatus}': {pollingResponseBody}");
                                                throw new InvalidOperationException($"jobResult response for {jobId} has an unknown direct status '{directStatus}': {pollingResponseBody}");
                                            }
                                        }
                                        else
                                        {
                                            // Отговорът не е нито в очакваната вложена структура, нито има директно свойство "status" в root елемента.
                                            Debug.WriteLine($"jobResult response for {jobId} has an unexpected structure (missing 'success'/'message' and no direct 'status' property): {pollingResponseBody}");
                                            throw new InvalidOperationException($"jobResult response for {jobId} has an unexpected structure: {pollingResponseBody}");
                                        }
                                    }
                                }
                            }
                            catch (JsonException e)
                            {
                                Debug.WriteLine($"Failed to parse jobResult response body as JSON for {jobId}: {e.Message}");
                                throw new JsonException($"Failed to parse jobResult response body as JSON for {jobId}: {e.Message}", e);
                            }
                        }
                        else
                        {
                            // Handle non-success status codes for polling requests
                            Debug.WriteLine($"jobResult polling request for {jobId} returned non-success status code: {pollingResponse.StatusCode}. Response body: {pollingResponseBody}");
                            // Do NOT return here. Continue polling until timeout or external cancellation.
                            // The loop will continue after the Task.Delay.
                        }
                    }
                }
                catch (OperationCanceledException ex) when (pollingCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
                {
                    // Polling timed out (cancellation came from pollingCts, not the original token)
                    Debug.WriteLine($"Polling for job ID {jobId} timed out after {PollingTimeoutSeconds} seconds.");
                    throw new OperationCanceledException($"Polling for job result timed out after {PollingTimeoutSeconds} seconds.", ex, linkedToken);
                }
                catch (OperationCanceledException)
                {
                    // Original cancellation token was cancelled
                    Debug.WriteLine($"Polling for job ID {jobId} was cancelled externally.");
                    throw; // Propagate original cancellation
                }
                catch (HttpRequestException e)
                {
                    Debug.WriteLine($"jobResult HttpRequestException for {jobId}: {e.Message}{(e.InnerException != null ? $", Inner Exception: {e.InnerException.Message}" : "")}");
                    throw new HttpRequestException($"jobResult polling request error for {jobId}: {e.Message}", e);
                }
                catch (Exception e)
                {
                    Debug.WriteLine($"An unexpected error occurred during jobResult polling for {jobId}: {e.Message}");
                    throw new Exception($"An unexpected error occurred during jobResult polling for {jobId}: {e.Message}", e);
                }
            }
        }

        /// <summary>
        /// Dispatches an image generation job and polls for its result.
        /// </summary>
        /// <param name="promptText">The main text prompt for the image.</param>
        /// <param name="style1settings">List of style settings for style 1.</param>
        /// <param name="style2settings">List of style settings for style 2.</param>
        /// <param name="cancellationToken">Cancellation token to cancel the entire dispatch and polling process.</param>
        /// <returns>A string containing the final job result JSON body or an error message.</returns>
        public async Task<string> DispatchAsync(string promptText, List<string> style1settings, List<string> style2settings, CancellationToken cancellationToken = default)
        {
            // Prepare the request payload for jobSend
            var sendJobRequestData = new
            {
                // userId is now generated dynamically
                userId =  Guid.NewGuid().ToString(), 
                input_image_prompt = promptText,
                input_image_style1 = style1settings, // Will be serialized as a JSON array
                input_image_style2 = style2settings, // Will be serialized as a JSON array
                input_image_url = (string)null,   // Placeholder for input_image_url
                parameters = new { }              // Placeholder for parameters (empty object)
            };

            string jobId = null;

       
            // --- Step 1: Send the initial job request ---
            try          
            {
                jobId = await SendJobAsync(promptText, style1settings, style2settings, cancellationToken);
            }
            catch (Exception ex)
            {
                // Catch specific exceptions from SendJobAsync and format the error message
                Debug.WriteLine($"Error sending job: {ex.Message}");
                return $"Error sending job: {ex.Message}";
            }

            // --- Step 2: Poll for job result ---
            // PollJobResultAsync handles its own timeout and cancellation linking
            try
            {
                return await PollJobResultAsync(jobId, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // This exception is thrown by PollJobResultAsync on timeout or external cancellation
                Debug.WriteLine($"Polling for job {jobId} was cancelled or timed out.");
                return $"Job processing cancelled or timed out.";
            }
            catch (Exception e)
            {
                // Catch other exceptions from PollJobResultAsync and format the error message
                Debug.WriteLine($"Error polling for job {jobId}: {e.Message}");
                return $"Error polling for job result: {e.Message}";
            }
        }
    }

    // Helper class for JSON parsing (assuming simple structure)
    // This might need adjustment based on the actual Node.js response format
    // private class JobSendResponse
    // {
    //     public string JobId { get; set; }
    //     public string Status { get; set; } // e.g., "accepted"
    // }

    // private class JobResultResponse
    // {
    //     public string Status { get; set; } // e.g., "pending", "completed", "failed"
    //     public JsonElement Result { get; set; } // Can be anything, e.g., array of image URLs
    //     public string Error { get; set; } // For failed status
    // }
}
