import 'package:flutter/material.dart';
import 'dart:math';

class AnimatedBackground extends StatefulWidget {
  final Widget child;

  const AnimatedBackground({super.key, required this.child});

  @override
  State<AnimatedBackground> createState() => _AnimatedBackgroundState();
}

class _AnimatedBackgroundState extends State<AnimatedBackground> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat(reverse: true);

    _animation = Tween<double>(begin: 0, end: 1).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        AnimatedBuilder(
          animation: _animation,
          builder: (context, child) {
            return CustomPaint(
              painter: BlobPainter(_animation.value),
              child: Container(),
            );
          },
        ),
        widget.child,
      ],
    );
  }
}

class BlobPainter extends CustomPainter {
  final double animationValue;

  BlobPainter(this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    final paint1 = Paint()
      ..color = Colors.blue.withOpacity(0.3)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 50);

    final paint2 = Paint()
      ..color = Colors.purple.withOpacity(0.3)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 50);

    final offset1 = Offset(
      size.width * 0.2 + sin(animationValue * 2 * pi) * 30,
      size.height * 0.2 + cos(animationValue * 2 * pi) * 50,
    );
    canvas.drawCircle(offset1, size.width * 0.3, paint1);

    final offset2 = Offset(
      size.width * 0.8 + cos(animationValue * 2 * pi / 1.5) * 40,
      size.height * 0.8 + sin(animationValue * 2 * pi / 1.5) * 40,
    );
    canvas.drawCircle(offset2, size.width * 0.4, paint2);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    return true;
  }
}