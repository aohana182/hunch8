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
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.font.FontWeight
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

    // Slow idle tumble: real 3D perspective rotation (rotationX/Y with a camera
    // distance), not a flat 2D spin — this is what actually reads as a sphere
    // turning in space rather than a static icon.
    val idleRotationY by infiniteTransition.animateFloat(
        initialValue = -12f,
        targetValue = 12f,
        animationSpec = infiniteRepeatable(
            animation = tween(2600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "idleRotationY",
    )
    val idleRotationX by infiniteTransition.animateFloat(
        initialValue = -5f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(
            animation = tween(3400, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "idleRotationX",
    )

    val thinkingRotationZ by infiniteTransition.animateFloat(
        initialValue = -10f,
        targetValue = 10f,
        animationSpec = infiniteRepeatable(
            animation = tween(160, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "thinkingRotationZ",
    )
    val thinkingRotationX by infiniteTransition.animateFloat(
        initialValue = -14f,
        targetValue = 14f,
        animationSpec = infiniteRepeatable(
            animation = tween(220, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "thinkingRotationX",
    )

    val rotationX = if (state == BallState.THINKING) thinkingRotationX else idleRotationX
    val rotationY = if (state == BallState.THINKING) 0f else idleRotationY
    val rotationZ = if (state == BallState.THINKING) thinkingRotationZ else 0f

    val description = when (state) {
        BallState.IDLE -> "Tap to ask Hunch8"
        BallState.THINKING -> "Hunch8 is thinking"
        BallState.ANSWERED -> "Hunch8 answered: $answerText"
        BallState.ERROR -> "Hunch8 needs internet"
    }

    Box(
        modifier = modifier
            .size(240.dp)
            .graphicsLayer {
                this.rotationX = rotationX
                this.rotationY = rotationY
                this.rotationZ = rotationZ
                cameraDistance = 16f * density
            }
            .clip(CircleShape)
            .clickable(enabled = state != BallState.THINKING) { onTap() }
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val highlightCenter = Offset(size.width * 0.30f, size.height * 0.24f)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Hunch8BallHighlight, Color(0xFF0A0A0A), Hunch8BallShadow),
                    center = highlightCenter,
                    radius = size.minDimension * 0.95f,
                ),
                radius = size.minDimension / 2f,
            )
            // Specular shine: a tight, soft highlight blob so a black sphere on a
            // black window still reads as glossy and 3D rather than a flat disc.
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color.White.copy(alpha = 0.16f), Color.Transparent),
                    center = highlightCenter,
                    radius = size.minDimension * 0.22f,
                ),
                radius = size.minDimension * 0.22f,
                center = highlightCenter,
            )
            drawCircle(
                color = Hunch8Amber.copy(alpha = 0.18f),
                radius = size.minDimension / 2f - 2f,
                style = Stroke(width = 3f),
            )
        }

        // Window sits in the lower third, off-center and non-circular — avoids
        // the centered-circle-on-circle "eye" look and echoes (without copying)
        // the real toy's low window placement.
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 28.dp)
                .size(width = 168.dp, height = 108.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color.Black)
                .padding(10.dp),
            contentAlignment = Alignment.Center,
        ) {
            AnimatedContent(targetState = state, label = "ballWindow") { windowState ->
                when (windowState) {
                    BallState.IDLE -> Text(
                        "ask me",
                        color = Hunch8Amber.copy(alpha = 0.7f),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    BallState.THINKING -> Text(
                        "···",
                        color = Hunch8Amber,
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    BallState.ANSWERED -> Text(
                        answerText,
                        color = Hunch8OnBackground,
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.titleLarge,
                    )
                    BallState.ERROR -> Text(
                        "needs internet",
                        color = Hunch8Error,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }
        }
    }
}
