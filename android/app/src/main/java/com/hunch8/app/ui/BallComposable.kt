package com.hunch8.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.first
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

enum class BallState { IDLE, THINKING, ANSWERED, ERROR, RATE_LIMITED }

private val BallSize = 300.dp
private const val WINDOW_RADIUS = 0.6f // fraction of the ball's radius
private const val EIGHT_RADIUS = 0.36f
private val LightPosition = Offset(0.34f, 0.28f) // fraction of the ball's size

private enum class TriangleStyle { NORMAL, ERROR, RATE_LIMITED }

private val TriangleTop = Color(0xFF2E4390)
private val TriangleBottom = Color(0xFF17245A)
private val TriangleErrorTop = Color(0xFF7A3328)
private val TriangleErrorBottom = Color(0xFF4A1C16)
private val TriangleRateLimitTop = Color(0xFF8A6A2E)
private val TriangleRateLimitBottom = Color(0xFF4A3714)
private val AnswerTextColor = Color(0xFFE6ECF7)

@Composable
fun BallComposable(
    state: BallState,
    answerText: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // A sphere's outline never changes as it turns, so the fake 3D comes from
    // moving the surface features (the "8" and the window) across a fixed
    // circle with spherical foreshortening, not from tilting the whole disc.
    val flip = remember { Animatable(0f) }
    val reveal = remember { Animatable(0f) }

    LaunchedEffect(state) {
        if (state != BallState.IDLE && flip.value < 180f) {
            flip.animateTo(180f, tween(750, easing = FastOutSlowInEasing))
        }
    }
    LaunchedEffect(state, answerText) {
        when (state) {
            BallState.THINKING -> reveal.animateTo(0f, tween(220))
            BallState.ANSWERED, BallState.ERROR, BallState.RATE_LIMITED -> {
                snapshotFlow { flip.value }.first { it >= 180f }
                reveal.snapTo(0f)
                reveal.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessVeryLow))
            }
            BallState.IDLE -> Unit
        }
    }

    val infinite = rememberInfiniteTransition(label = "ball")
    val bob by infinite.animateFloat(
        initialValue = -4f,
        targetValue = 4f,
        animationSpec = infiniteRepeatable(tween(2200, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bob",
    )
    val shake by infinite.animateFloat(
        initialValue = -1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(70, easing = LinearEasing), RepeatMode.Reverse),
        label = "shake",
    )
    val thinking = state == BallState.THINKING

    val description = when (state) {
        BallState.IDLE -> "Magic ball. Tap to ask."
        BallState.THINKING -> "The ball is thinking"
        BallState.ANSWERED -> "The ball says: $answerText"
        BallState.ERROR -> "The app isn't responding"
        BallState.RATE_LIMITED -> "Daily limit reached, come back tomorrow"
    }

    Box(modifier = modifier.size(BallSize, BallSize + 36.dp), contentAlignment = Alignment.TopCenter) {
        Canvas(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .size(BallSize * 0.8f, 36.dp),
        ) {
            val lift = (bob + 4f) / 8f
            withTransform({ scale(1f, 0.16f, pivot = center) }) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.Black.copy(alpha = 0.55f - 0.15f * lift), Color.Transparent),
                        center = center,
                        radius = size.width / 2f,
                    ),
                    radius = size.width / 2f,
                )
            }
        }

        Box(
            modifier = Modifier
                .size(BallSize)
                .graphicsLayer {
                    translationY = (if (thinking) 0f else bob).dp.toPx()
                    translationX = if (thinking) (shake * 7f).dp.toPx() else 0f
                    rotationZ = if (thinking) shake * 4f else 0f
                }
                .clip(CircleShape)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    enabled = !thinking,
                    onClick = onTap,
                )
                .semantics {
                    contentDescription = description
                    role = Role.Button
                },
            contentAlignment = Alignment.Center,
        ) {
            val textMeasurer = rememberTextMeasurer()
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawSphereBody()
                drawEightDecal(flip.value, textMeasurer)
                drawWindowDecal(flip.value)
                drawSphereShading()
            }

            if (flip.value >= 180f) {
                val (text, style) = when (state) {
                    BallState.ERROR -> "App not\nresponding" to TriangleStyle.ERROR
                    BallState.RATE_LIMITED -> "Daily limit\nreached" to TriangleStyle.RATE_LIMITED
                    else -> answerText to TriangleStyle.NORMAL
                }
                FloatingAnswer(
                    text = text,
                    style = style,
                    progress = reveal.value,
                    windowDiameter = BallSize * WINDOW_RADIUS,
                )
            }

            Canvas(modifier = Modifier.fillMaxSize()) { drawGloss() }
        }
    }
}

@Composable
private fun FloatingAnswer(text: String, style: TriangleStyle, progress: Float, windowDiameter: Dp) {
    if (progress <= 0.01f) return
    val circumradius = windowDiameter / 2f * 0.9f
    Box(
        modifier = Modifier
            .size(windowDiameter)
            .graphicsLayer {
                // Rising out of the dark liquid: small, dim, tilted, and lower,
                // settling with a spring overshoot that reads as a wobble.
                val p = progress
                alpha = p.coerceIn(0f, 1f)
                scaleX = 0.55f + 0.45f * p
                scaleY = 0.55f + 0.45f * p
                rotationZ = (1f - p) * -28f
                translationY = ((1f - p) * 22f).dp.toPx()
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val rc = circumradius.toPx()
            val half = rc * sqrt(3f) / 2f
            val path = Path().apply {
                moveTo(center.x - half, center.y - rc / 2f)
                lineTo(center.x + half, center.y - rc / 2f)
                lineTo(center.x, center.y + rc)
                close()
            }
            val colors = when (style) {
                TriangleStyle.NORMAL -> listOf(TriangleTop, TriangleBottom)
                TriangleStyle.ERROR -> listOf(TriangleErrorTop, TriangleErrorBottom)
                TriangleStyle.RATE_LIMITED -> listOf(TriangleRateLimitTop, TriangleRateLimitBottom)
            }
            val brush = Brush.verticalGradient(colors = colors, startY = center.y - rc / 2f, endY = center.y + rc)
            drawPath(path, brush)
            drawPath(path, brush, style = Stroke(width = 10f, join = StrokeJoin.Round))
        }
        // Text area kept inside the triangle's wide upper part.
        Box(
            modifier = Modifier
                .offset(y = -circumradius * 0.12f)
                .size(width = circumradius * 1.12f, height = circumradius * 0.95f),
            contentAlignment = Alignment.Center,
        ) {
            val fontSize = answerFontSize(text)
            Text(
                text = text,
                color = AnswerTextColor,
                textAlign = TextAlign.Center,
                style = TextStyle(fontSize = fontSize, lineHeight = fontSize * 1.1f, fontWeight = FontWeight.Bold),
            )
        }
    }
}

private fun answerFontSize(text: String) = when {
    text.length <= 4 -> 26.sp
    text.length <= 12 -> 20.sp
    text.length <= 18 -> 16.sp
    else -> 14.sp
}

private fun DrawScope.drawSphereBody() {
    val r = size.minDimension / 2f
    val light = Offset(size.width * LightPosition.x, size.height * LightPosition.y)
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Color(0xFF45484E), Color(0xFF16171A), Color(0xFF050505), Color.Black),
            center = light,
            radius = r * 1.55f,
        ),
    )
}

// Drawn over the decals so the "8" disc and the window share the sphere's lighting.
private fun DrawScope.drawSphereShading() {
    val r = size.minDimension / 2f
    val light = Offset(size.width * LightPosition.x, size.height * LightPosition.y)
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.45f)),
            center = light,
            radius = r * 1.6f,
        ),
    )
    // Edge darkening makes the disc read as round rather than flat.
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Color.Transparent, Color.Transparent, Color.Black.copy(alpha = 0.7f)),
            center = center,
            radius = r,
        ),
    )
    // Blue bounce light from the background along the lower rim.
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Hunch8Background.copy(alpha = 0f), Color(0xFF2A4A70).copy(alpha = 0.35f)),
            center = Offset(center.x, center.y - r * 0.15f),
            radius = r * 1.02f,
        ),
    )
}

// Features sit on the sphere's surface at a polar angle; turning the ball by
// `flip` degrees moves them along the vertical axis with cos() foreshortening.
private inline fun DrawScope.onSurface(angleDeg: Float, block: DrawScope.() -> Unit) {
    val a = Math.toRadians(angleDeg.toDouble())
    val squash = cos(a).toFloat()
    if (squash <= 0.02f) return
    val r = size.minDimension / 2f
    val y = center.y - r * sin(a).toFloat()
    withTransform({
        translate(center.x, y)
        scale(1f, squash, pivot = Offset.Zero)
    }) { block() }
}

private fun DrawScope.drawEightDecal(flip: Float, textMeasurer: TextMeasurer) {
    onSurface(flip) {
        val r = size.minDimension / 2f * EIGHT_RADIUS
        drawCircle(Color(0xFFF2F2EE), radius = r, center = Offset.Zero)
        val layout = textMeasurer.measure(
            "8",
            TextStyle(color = Color(0xFF111111), fontSize = 64.sp, fontWeight = FontWeight.Black),
        )
        drawText(layout, topLeft = Offset(-layout.size.width / 2f, -layout.size.height / 2f))
    }
}

private fun DrawScope.drawWindowDecal(flip: Float) {
    onSurface(flip - 180f) {
        val r = size.minDimension / 2f * WINDOW_RADIUS
        // Recessed lip: lit on top, falling into shadow at the bottom.
        drawCircle(
            brush = Brush.verticalGradient(
                colors = listOf(Color(0xFF3A3D42), Color(0xFF0A0A0A)),
                startY = -r - 8f,
                endY = r + 8f,
            ),
            radius = r + 8f,
            center = Offset.Zero,
        )
        drawCircle(Color.Black, radius = r, center = Offset.Zero)
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Color(0xFF0B0E16), Color.Black),
                center = Offset.Zero,
                radius = r,
            ),
            radius = r,
            center = Offset.Zero,
        )
    }
}

private fun DrawScope.drawGloss() {
    val r = size.minDimension / 2f
    val light = Offset(size.width * LightPosition.x, size.height * LightPosition.y)
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Color.White.copy(alpha = 0.10f), Color.Transparent),
            center = light,
            radius = r * 0.55f,
        ),
        radius = r * 0.55f,
        center = light,
    )
    withTransform({
        rotate(-35f, pivot = light)
        scale(1.6f, 0.8f, pivot = light)
    }) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Color.White.copy(alpha = 0.42f), Color.Transparent),
                center = light,
                radius = r * 0.13f,
            ),
            radius = r * 0.13f,
            center = light,
        )
    }
}
