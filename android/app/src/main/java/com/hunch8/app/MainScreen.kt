package com.hunch8.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hunch8.app.network.Hunch8Result
import com.hunch8.app.network.ProxyClient
import kotlinx.coroutines.launch

private sealed class UiState {
    object Idle : UiState()
    object Loading : UiState()
    data class Answered(val text: String) : UiState()
    object Error : UiState()
}

@Composable
fun MainScreen() {
    var question by remember { mutableStateOf("") }
    var background by remember { mutableStateOf("") }
    var uiState by remember { mutableStateOf<UiState>(UiState.Idle) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Hunch8", style = MaterialTheme.typography.headlineMedium)

        OutlinedTextField(
            value = question,
            onValueChange = { question = it },
            label = { Text("What's the question?") },
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = background,
            onValueChange = { background = it },
            label = { Text("Give it some background") },
            modifier = Modifier.fillMaxWidth(),
        )

        Button(
            onClick = {
                if (question.isBlank()) return@Button
                uiState = UiState.Loading
                scope.launch {
                    uiState = when (val result = ProxyClient.ask(question, background)) {
                        is Hunch8Result.Success -> UiState.Answered(result.answer.answer)
                        is Hunch8Result.NetworkError -> UiState.Error
                    }
                }
            },
            enabled = question.isNotBlank() && uiState !is UiState.Loading,
        ) {
            Text("Ask")
        }

        when (val state = uiState) {
            is UiState.Loading -> CircularProgressIndicator()
            is UiState.Answered -> Text(state.text, style = MaterialTheme.typography.headlineSmall)
            is UiState.Error -> Text("Needs internet")
            is UiState.Idle -> Unit
        }
    }
}
