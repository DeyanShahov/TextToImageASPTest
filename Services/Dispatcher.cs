using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace TextToImageASPTest.Services
{
    public class Dispatcher
    {
        private static readonly HttpClient httpClient;
        private const string NGINX_BASE_URL = "https://cloudflireservices-app.onrender.com";
        private const string NginxSendJobUrl = $"{NGINX_BASE_URL}/jobsRedis";
        //private const string NginxSendJobUrl = "http://77.77.134.134:81/jobSend";
        //private const string NginxSendJobUrl = "http://localhost:81/jobSend";
        //private const string NginxSendJobUrl = "http://localhost:3000/jobsRedis";
        private const string NginxResultJobUrl = $"{NGINX_BASE_URL}/jobResult"; // New endpoint for polling
        //private const string NginxResultJobUrl = "http://77.77.134.134:81/jobResult"; // New endpoint for polling
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
        /// <param name="advancedSettings">DTO containing advanced parameters for the job.</param>
        /// <param name="cancellationToken">Cancellation token to cancel the operation.</param>
        /// <returns>The jobId string received from the server.</returns>
        /// <exception cref="JsonException">Thrown if serialization or deserialization fails.</exception>
        /// <exception cref="HttpRequestException">Thrown if the HTTP request fails.</exception>
        /// <exception cref="OperationCanceledException">Thrown if the operation is cancelled.</exception>
        /// <exception cref="Exception">Thrown for other unexpected errors.</exception>
        /// <exception cref="InvalidOperationException">Thrown if the server response is missing the jobId.</exception>
        public async Task<string> SendJobAsync(string promptText, List<string> style1settings, List<string> style2settings, AdvancedSettingsDto advancedSettings, CancellationToken cancellationToken)
        {
            // Конструиране на обекта 'parameters' въз основа на advancedSettings
            // Имената на полетата тук трябва да съответстват на това, което бекендът очаква.
            // Това е примерен мапинг.
            var backendParameters = new Dictionary<string, object>();

            if (advancedSettings.UseCfgScale)
            {
                backendParameters["cfg_scale"] = advancedSettings.CfgScale;
            }
            backendParameters["batch_size"] = advancedSettings.BatchSize; // Бекендът може да очаква друго име, напр. "n_iter" или "batch_count"

            if (advancedSettings.UseScheduler)
            {
                // Пример: бекендът може да очаква "scheduler_name" и "sampler_name"
                // или просто "scheduler" с "karras" / "normal"
                backendParameters["scheduler"] = advancedSettings.IsKarras ? "karras" : "normal"; // Това е предположение
            }

            // PositivePrompt и NegativePrompt от DTO-то може да се добавят тук, ако бекендът ги очаква като отделни параметри.
            if (!string.IsNullOrWhiteSpace(advancedSettings.PositivePrompt))
            {
                backendParameters["positive_prompt"] = advancedSettings.PositivePrompt; // Името на полето зависи от бекенда
            }
            // Ако NegativePrompt е празно, не го добавяме, за да избегнем изпращане на празни стойности
            if (!string.IsNullOrWhiteSpace(advancedSettings.NegativePrompt))
            {
                backendParameters["negative_prompt"] = advancedSettings.NegativePrompt; // Името на полето зависи от бекенда
            }


            var sendJobRequestData = new
            {
                userId = Guid.NewGuid().ToString(),
                input_image_prompt = promptText,
                input_image_style1 = style1settings, // Will be serialized as a JSON array
                input_image_style2 = style2settings, // Will be serialized as a JSON array
                input_image_url = (string)null,   // Placeholder for input_image_url
                parameters = backendParameters.Any() ? backendParameters : new object() // Изпращаме конструираните параметри
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

            Debug.WriteLine($"Sending job request to {NginxSendJobUrl}");
            using (HttpResponseMessage sendJobResponse = await httpClient.PostAsync(NginxSendJobUrl, content, cancellationToken))
            {
                // Read the response content
                string sendJobResponseBody = await sendJobResponse.Content.ReadAsStringAsync(cancellationToken);
                Debug.WriteLine($"jobSend Status Code: {sendJobResponse.StatusCode}");
                Debug.WriteLine($"jobSend Response Body: {sendJobResponseBody}");

                if (sendJobResponse.StatusCode == System.Net.HttpStatusCode.Created)
                {
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

                Debug.WriteLine($"jobSend request failed with status code: {sendJobResponse.StatusCode}. Response body: {sendJobResponseBody}");
                throw new HttpRequestException($"jobSend request failed with status code {sendJobResponse.StatusCode}. Response: {sendJobResponseBody}");
            }
        }

        /// <summary>
        /// Polls the jobResult endpoint for the status of a specific job ID until it's completed or failed, or timeout occurs.
        /// </summary>
        /// <param name="jobId">The ID of the job to poll for.</param>
        /// <param name="cancellationToken">Cancellation token to cancel the polling.</param>
        /// <returns>A <see cref="JobResultDto"/> if the job is completed successfully, otherwise the raw JSON string response.</returns>
        /// <exception cref="OperationCanceledException">Thrown if the polling is cancelled or times out.</exception>
        /// <exception cref="HttpRequestException">Thrown if an HTTP request during polling fails.</exception>
        /// <exception cref="JsonException">Thrown if parsing the JSON response fails.</exception>
        /// <exception cref="InvalidOperationException">Thrown if the jobResult response format is unexpected (e.g., missing status).</exception>
        /// <exception cref="Exception">Thrown for other unexpected errors during polling.</exception>
        public async Task<object> PollJobResultAsync(string jobId, CancellationToken cancellationToken)
        {
            //Debug.WriteLine($"Starting polling for job ID: {jobId}");

            using (var pollingCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken))
            {
                pollingCts.CancelAfter(TimeSpan.FromSeconds(PollingTimeoutSeconds));
                CancellationToken linkedToken = pollingCts.Token;

                try
                {
                    while (true)
                    {
                        linkedToken.ThrowIfCancellationRequested();
                        await Task.Delay(TimeSpan.FromSeconds(PollingIntervalSeconds), linkedToken);
                        string pollingUrl = $"{NginxResultJobUrl}?jobId={Uri.EscapeDataString(jobId)}";
                        // Debug.WriteLine($"Polling {pollingUrl}");

                        using (HttpResponseMessage pollingResponse = await httpClient.GetAsync(pollingUrl, linkedToken))
                        {
                            string pollingResponseBody = await pollingResponse.Content.ReadAsStringAsync(linkedToken);
                            //Debug.WriteLine($"jobResult Status Code: {pollingResponse.StatusCode}");
                            //Debug.WriteLine($"jobResult Response Body: {pollingResponseBody}");

                            if (pollingResponse.IsSuccessStatusCode)
                            {
                                try
                                {
                                    using (JsonDocument doc = JsonDocument.Parse(pollingResponseBody))
                                    {
                                        if (doc.RootElement.TryGetProperty("status", out JsonElement statusElement))
                                        {
                                            string status = statusElement.GetString();
                                            Debug.WriteLine($"Job status for {jobId}: {status}");

                                            // Списък с всички познати междинни статуси, които означават "продължи да полираш"
                                            // var knownPollingStatuses = new List<string> { "pending", "processing", "waiting_comfyui", "processing_comfyui" /*, добави други ако има */ };

                                            if (status.Equals("completed", StringComparison.OrdinalIgnoreCase))
                                            {
                                                // Десериализираме целия отговор в JobResultDto
                                                // JsonSerializer.Deserialize ще хвърли JsonException, ако структурата не съвпада
                                                JobResultDto resultDto = JsonSerializer.Deserialize<JobResultDto>(pollingResponseBody);
                                                if (resultDto != null && !string.IsNullOrEmpty(resultDto.ImageDataBase64) && !string.IsNullOrEmpty(resultDto.ImageType))
                                                {
                                                    Debug.WriteLine($"Job {jobId} completed successfully. Returning DTO.");
                                                    return resultDto;
                                                }
                                                else
                                                {
                                                    Debug.WriteLine($"Job {jobId} reported 'completed' but DTO deserialization failed or data is missing. Response length: {pollingResponseBody.Length}");
                                                    // Връщаме суровия отговор, за да може HomeController да го логне/обработи като грешка
                                                    return pollingResponseBody;
                                                }
                                            }
                                            else if (status.Equals("pending", StringComparison.OrdinalIgnoreCase) ||
                                                status.Equals("processing", StringComparison.OrdinalIgnoreCase) ||
                                                status.Equals("processing_comfyui", StringComparison.OrdinalIgnoreCase))
                                            {
                                                // Задачата все още се обработва. Продължаваме с постването.
                                                // Цикълът ще се повтори след забавянето.
                                            }
                                            else
                                            {
                                                // За всички други статуси (failed, not_found, etc.), връщаме целия JSON отговор като стринг
                                                Debug.WriteLine($"Job {jobId} has status '{status}'. Returning raw response. Length: {pollingResponseBody.Length}");
                                                return pollingResponseBody;
                                            }
                                        }
                                        else
                                        {
                                            Debug.WriteLine($"jobResult response for {jobId} is missing 'status' property. Response length: {pollingResponseBody.Length}");
                                            throw new InvalidOperationException($"jobResult response for {jobId} is missing 'status' property. Response (snippet): {pollingResponseBody.Substring(0, Math.Min(pollingResponseBody.Length, 200))}");
                                        }
                                    }
                                }
                                catch (JsonException e)
                                {
                                    Debug.WriteLine($"Failed to parse jobResult response body as JSON for {jobId}: {e.Message}");
                                    throw new JsonException($"Failed to parse jobResult response body as JSON for {jobId}: {e.Message}", e);
                                }
                            }
                        }
                    }
                }
                catch (OperationCanceledException ex) when (pollingCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
                {
                    Debug.WriteLine($"Polling for job ID {jobId} timed out after {PollingTimeoutSeconds} seconds.");
                    throw new OperationCanceledException($"Polling for job result timed out after {PollingTimeoutSeconds} seconds.", ex, linkedToken);
                }
                catch (OperationCanceledException)
                {
                    Debug.WriteLine($"Polling for job ID {jobId} was cancelled externally.");
                    throw;
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
        /// <param name="advancedSettings">DTO containing advanced parameters for the job.</param>
        /// <param name="cancellationToken">Cancellation token to cancel the entire dispatch and polling process.</param>
        /// <returns>A <see cref="JobResultDto"/> on successful completion, or a string containing an error message or other status JSON.</returns>
        // public async Task<object> DispatchAsync(string promptText, List<string> style1settings, List<string> style2settings, AdvancedSettingsDto advancedSettings, CancellationToken cancellationToken = default)
        // {
        //     string jobId = null;


        //     // --- Step 1: Send the initial job request ---
        //     try
        //     {
        //         jobId = await SendJobAsync(promptText, style1settings, style2settings, advancedSettings, cancellationToken);
        //         //return jobId;
        //     }
        //     catch (Exception ex)
        //     {
        //         // Catch specific exceptions from SendJobAsync and format the error message
        //         Debug.WriteLine($"Error sending job: {ex.Message}");
        //         return $"Error sending job: {ex.Message}";
        //     }

        //     // --- Step 2: Poll for job result ---
        //     // PollJobResultAsync handles its own timeout and cancellation linking
        //     try
        //     {
        //         return await PollJobResultAsync(jobId, cancellationToken);
        //     }
        //     catch (OperationCanceledException)
        //     {
        //         // This exception is thrown by PollJobResultAsync on timeout or external cancellation
        //         Debug.WriteLine($"Polling for job {jobId} was cancelled or timed out.");
        //         return $"Job processing cancelled or timed out.";
        //     }
        //     catch (Exception e)
        //     {
        //         // Catch other exceptions from PollJobResultAsync and format the error message
        //         Debug.WriteLine($"Error polling for job {jobId}: {e.Message}");
        //         return $"Error polling for job result: {e.Message}";
        //     }
        // }


    }
}
