import 'dart:io';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

class VideoPitchPlayer extends StatefulWidget {
  final String? videoUrl;
  final String? localPath;

  const VideoPitchPlayer({
    super.key,
    this.videoUrl,
    this.localPath,
  });

  @override
  State<VideoPitchPlayer> createState() => _VideoPitchPlayerState();
}

class _VideoPitchPlayerState extends State<VideoPitchPlayer> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String _errorMessage = "";

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  @override
  void didUpdateWidget(covariant VideoPitchPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.videoUrl != oldWidget.videoUrl || widget.localPath != oldWidget.localPath) {
      _initializePlayer();
    }
  }

  Future<void> _initializePlayer() async {
    // Dispose previous controller if exists
    if (_controller != null) {
      await _controller!.dispose();
      setState(() {
        _isInitialized = false;
        _hasError = false;
      });
    }

    try {
      if (widget.localPath != null && widget.localPath!.isNotEmpty) {
        _controller = VideoPlayerController.file(File(widget.localPath!));
      } else if (widget.videoUrl != null && widget.videoUrl!.isNotEmpty) {
        _controller = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl!));
      } else {
        setState(() {
          _hasError = true;
          _errorMessage = "No video source provided";
        });
        return;
      }

      await _controller!.initialize();
      setState(() {
        _isInitialized = true;
      });
    } catch (e) {
      setState(() {
        _hasError = true;
        _errorMessage = "Error loading video: $e";
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.black87,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
                  const SizedBox(height: 8),
                  Text(
                    _errorMessage,
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (!_isInitialized || _controller == null) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.black87,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(
            child: CircularProgressIndicator(color: Colors.deepPurpleAccent),
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: _controller!.value.aspectRatio,
        child: Stack(
          alignment: Alignment.bottomCenter,
          children: [
            VideoPlayer(_controller!),
            // Controls overlay
            _buildControlsOverlay(),
            // Video progress bar
            VideoProgressIndicator(
              _controller!,
              allowScrubbing: true,
              colors: const VideoProgressColors(
                playedColor: Colors.deepPurpleAccent,
                bufferedColor: Colors.white24,
                backgroundColor: Colors.white12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsOverlay() {
    return GestureDetector(
      onTap: () {
        setState(() {
          _controller!.value.isPlaying ? _controller!.pause() : _controller!.play();
        });
      },
      child: Container(
        color: Colors.black26,
        child: Center(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 150),
            child: _controller!.value.isPlaying
                ? const SizedBox.shrink()
                : Container(
                    padding: const EdgeInsets.all(12),
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_arrow,
                      color: Colors.white,
                      size: 40.0,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
