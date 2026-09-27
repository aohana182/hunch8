package com.hunch8.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Hunch8Background = Color(0xFF0B1826)
val Hunch8Surface = Color(0xFF122333)
val Hunch8Amber = Color(0xFFC9A05C)
val Hunch8OnBackground = Color(0xFFC9D4E0)
val Hunch8Error = Color(0xFFC77B67)
val Hunch8BallHighlight = Color(0xFF2E2E2E)
val Hunch8BallShadow = Color(0xFF000000)

private val Hunch8ColorScheme = darkColorScheme(
    background = Hunch8Background,
    surface = Hunch8Surface,
    primary = Hunch8Amber,
    onPrimary = Hunch8Background,
    onBackground = Hunch8OnBackground,
    onSurface = Hunch8OnBackground,
    error = Hunch8Error,
)

@Composable
fun Hunch8Theme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Hunch8ColorScheme, content = content)
}
