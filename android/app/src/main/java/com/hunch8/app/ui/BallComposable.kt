package com.hunch8.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

enum class BallState { IDLE, THINKING, ANSWERED, ERROR }

@Composable
fun BallComposable(
    state: BallState,
    answerText: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "ball")

    val idleScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.03f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "idleScale",
    )

    val thinkingRotation by infiniteTransition.animateFloat(
        initialValue = -8f,
        targetValue = 8f,
        animationSpec = infiniteRepeatable(
            animation = tween(180, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "thinkingRotation",
    )

    val scale = if (state == BallState.IDLE) idleScale else 1f
    val rotation = if (state == BallState.THINKING) thinkingRotation else 0f

    val description = when (state) {
        BallState.IDLE -> "Tap to ask Hunch8"
        BallState.THINKING -> "Hunch8 is thinking"
        BallState.ANSWERED -> "Hunch8 answered: $answerText"
        BallState.ERROR -> "Hunch8 needs internet"
    }

    Box(
        modifier = modifier
            .size(220.dp)
            .graphicsLayer(scaleX = scale, scaleY = scale, rotationZ = rotation)
            .clip(CircleShape)
            .clickable(enabled = state != BallState.THINKING) { onTap() }
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = Offset(size.width * 0.32f, size.height * 0.28f)
            val radius = size.minDimension * 0.85f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFF3A322A), Color(0xFF1A1512), Color(0xFF0A0806)),
                    center = center,
                    radius = radius,
                ),
                radius = size.minDimension / 2f,
            )
            drawCircle(
                color = Hunch8Amber.copy(alpha = 0.18f),
                radius = size.minDimension / 2f - 2f,
                style = Stroke(width = 3f),
            )
        }

        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .background(Color(0xFF050505))
                .padding(12.dp),
            contentAlignment = Alignment.Center,
        ) {
            AnimatedContent(targetState = state, label = "ballWindow") { windowState ->
                when (windowState) {
                    BallState.IDLE -> Text(
                        "ask me",
                        color = Hunch8Amber.copy(alpha = 0.6f),
                        style = MaterialTheme.typography.labelMedium,
                    )
                    BallState.THINKING -> Text(
                        "···",
                        color = Hunch8Amber,
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    BallState.ANSWERED -> Text(
                        answerText,
                        color = Hunch8OnBackground,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    BallState.ERROR -> Text(
                        "needs\ninternet",
                        color = Hunch8Error,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
        }
    }
}
