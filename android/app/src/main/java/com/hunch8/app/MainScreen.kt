package com.hunch8.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import com.hunch8.app.network.Hunch8Result
import com.hunch8.app.network.ProxyClient
import com.hunch8.app.ui.BallComposable
import com.hunch8.app.ui.BallState
import com.hunch8.app.ui.Hunch8Amber
import kotlinx.coroutines.launch

@Composable
fun MainScreen() {
    var question by remember { mutableStateOf("") }
    var ballState by remember { mutableStateOf(BallState.IDLE) }
    var answerText by remember { mutableStateOf("") }
    var showHelp by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(start = 24.dp, end = 24.dp, bottom = 24.dp, top = 56.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Text(
                "Hunch8",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.align(Alignment.Center),
            )
            IconButton(
                onClick = { showHelp = true },
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .size(32.dp)
                    .clip(CircleShape),
            ) {
                Text("?", style = MaterialTheme.typography.titleMedium, color = Hunch8Amber)
            }
        }

        OutlinedTextField(
            value = question,
            onValueChange = { question = it },
            label = {
                Text(
                    "Ask a question and provide some context",
                    style = MaterialTheme.typography.titleMedium,
                )
            },
            textStyle = MaterialTheme.typography.titleLarge,
            trailingIcon = {
                if (question.isNotEmpty()) {
                    IconButton(onClick = { question = "" }) {
                        Text("✕", style = MaterialTheme.typography.titleMedium, color = Hunch8Amber)
                    }
                }
            },
            minLines = 3,
            maxLines = 6,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Hunch8Amber,
                focusedLabelColor = Hunch8Amber,
            ),
            modifier = Modifier.fillMaxWidth(),
        )

        Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            BallComposable(
                state = ballState,
                answerText = answerText,
                onTap = {
                    if (question.isBlank() || ballState == BallState.THINKING) return@BallComposable
                    focusManager.clearFocus()
                    ballState = BallState.THINKING
                    scope.launch {
                        ballState = when (val result = ProxyClient.ask(question, "")) {
                            is Hunch8Result.Success -> {
                                answerText = result.answer.answer
                                BallState.ANSWERED
                            }
                            is Hunch8Result.RateLimited -> BallState.RATE_LIMITED
                            is Hunch8Result.NetworkError -> BallState.ERROR
                        }
                    }
                },
            )
        }
    }

    if (showHelp) {
        HelpDialog(onDismiss = { showHelp = false })
    }
}

@Composable
private fun HelpDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("How to use Hunch8") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("• Ask: type a yes/no question, plus any context that helps decide it.")
                Text("• Trigger: tap the ball.")
                Text("• Result: it rolls over and floats up one answer.")
                Text("• Requirement: needs internet — every answer is a live call.")

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                Text("Powered by Jev", style = MaterialTheme.typography.titleSmall, color = Hunch8Amber)
                Text(
                    "Jev is a decision model from TypeSafe, via OpenRouter. It doesn't " +
                        "generate text like a chatbot — it rates your question and returns a " +
                        "probability, which Hunch8 turns into one of the 20 classic answers. " +
                        "That's the difference from a random pick: it's an actual judgment call.",
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Got it") }
        },
    )
}
