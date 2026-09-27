package com.hunch8.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

private const val PROXY_URL = "https://hunch8-proxy.hunch8.workers.dev"
private val JSON_MEDIA_TYPE = "application/json".toMediaType()

data class Hunch8Answer(val answer: String, val confidence: Double)

sealed class Hunch8Result {
    data class Success(val answer: Hunch8Answer) : Hunch8Result()
    object RateLimited : Hunch8Result()
    object NetworkError : Hunch8Result()
}

object ProxyClient {
    private val client = OkHttpClient()

    suspend fun ask(question: String, background: String): Hunch8Result = withContext(Dispatchers.IO) {
        val requestJson = JSONObject().apply {
            put("question", question)
            put("background", background)
        }
        val request = Request.Builder()
            .url(PROXY_URL)
            .post(requestJson.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.code == 429) return@withContext Hunch8Result.RateLimited
                if (!response.isSuccessful) return@withContext Hunch8Result.NetworkError
                val body = response.body?.string() ?: return@withContext Hunch8Result.NetworkError
                val json = JSONObject(body)
                if (!json.has("answer")) return@withContext Hunch8Result.NetworkError
                Hunch8Result.Success(
                    Hunch8Answer(
                        answer = json.getString("answer"),
                        confidence = json.optDouble("confidence", 0.0),
                    )
                )
            }
        } catch (e: IOException) {
            Hunch8Result.NetworkError
        }
    }
}
