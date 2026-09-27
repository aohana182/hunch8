package com.hunch8.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    var background by remember { mutableStateOf("") }
    var ballState by remember { mutableStateOf(BallState.IDLE) }
    var answerText by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = Hunch8Amber,
        focusedLabelColor = Hunch8Amber,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Text("Hunch8", style = MaterialTheme.typography.headlineMedium)

        OutlinedTextField(
            value = question,
            onValueChange = { question = it },
            label = { Text("What's the question?") },
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = background,
            onValueChange = { background = it },
            label = { Text("Give it some background") },
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )

        BallComposable(
            state = ballState,
            answerText = answerText,
            onTap = {
                if (question.isBlank() || ballState == BallState.THINKING) return@BallComposable
                ballState = BallState.THINKING
                scope.launch {
                    ballState = when (val result = ProxyClient.ask(question, background)) {
                        is Hunch8Result.Success -> {
                            answerText = result.answer.answer
                            BallState.ANSWERED
                        }
                        is Hunch8Result.NetworkError -> BallState.ERROR
                    }
                }
            },
        )
    }
}
