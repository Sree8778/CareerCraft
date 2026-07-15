import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

/// Social feed — LinkedIn-style posts shared by candidates and recruiters.
/// Mirrors the web /feed page; gated by the "feed" platform flag upstream.
class FeedPage extends StatefulWidget {
  const FeedPage({super.key});

  @override
  State<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends State<FeedPage> {
  List<dynamic> _posts = [];
  bool _isLoading = true;
  bool _posting = false;
  final TextEditingController _composer = TextEditingController();
  final Map<String, TextEditingController> _commentDrafts = {};
  final Set<String> _openComments = {};

  String get _uid => FirebaseAuth.instance.currentUser?.uid ?? '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _composer.dispose();
    for (final c in _commentDrafts.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final posts = await fetchFeed();
    if (mounted) {
      setState(() {
        _posts = posts;
        _isLoading = false;
      });
    }
  }

  Future<void> _publish() async {
    final content = _composer.text.trim();
    if (content.isEmpty || _posting) return;
    setState(() => _posting = true);
    final post = await createFeedPost(content);
    if (mounted) {
      setState(() {
        _posting = false;
        if (post != null) {
          post['comments'] = post['comments'] ?? [];
          _posts.insert(0, post);
          _composer.clear();
        }
      });
      if (post == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to post. Is the feed enabled?')),
        );
      }
    }
  }

  Future<void> _toggleLike(Map<String, dynamic> post) async {
    // Optimistic update
    setState(() {
      final liked = post['likedByMe'] == true;
      post['likedByMe'] = !liked;
      post['likeCount'] = (post['likeCount'] ?? 0) + (liked ? -1 : 1);
    });
    await togglePostLike(post['id']);
  }

  Future<void> _comment(Map<String, dynamic> post) async {
    final ctrl = _commentDrafts[post['id']];
    final text = ctrl?.text.trim() ?? '';
    if (text.isEmpty) return;
    final comment = await addPostComment(post['id'], text);
    if (mounted && comment != null) {
      setState(() {
        (post['comments'] as List).add(comment);
        ctrl?.clear();
      });
    }
  }

  Future<void> _delete(Map<String, dynamic> post) async {
    final ok = await deleteFeedPost(post['id']);
    if (mounted && ok) {
      setState(() => _posts.removeWhere((p) => p['id'] == post['id']));
    }
  }

  String _timeAgo(String? iso) {
    if (iso == null) return '';
    try {
      final diff = DateTime.now().difference(DateTime.parse(iso));
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inHours < 1) return '${diff.inMinutes}m';
      if (diff.inDays < 1) return '${diff.inHours}h';
      return '${diff.inDays}d';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Feed',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              'Updates from candidates and recruiters',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
            const SizedBox(height: 16),

            // Composer
            GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    TextField(
                      controller: _composer,
                      maxLines: 3,
                      maxLength: 2000,
                      decoration: const InputDecoration(
                        hintText: 'Share an update, milestone, or question…',
                        border: InputBorder.none,
                        counterText: '',
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: _posting ? null : _publish,
                      icon: _posting
                          ? const SizedBox(
                              width: 14, height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.send, size: 16),
                      label: const Text('Post'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            if (_isLoading)
              const Center(
                  child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(),
              ))
            else if (_posts.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(
                    children: [
                      Icon(Icons.feed_outlined, size: 48, color: Colors.grey.shade600),
                      const SizedBox(height: 12),
                      const Text('Nothing here yet',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      Text('Be the first to post.',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    ],
                  ),
                ),
              )
            else
              ..._posts.map((post) => _buildPost(post as Map<String, dynamic>)),
          ],
        ),
      ),
    );
  }

  Widget _buildPost(Map<String, dynamic> post) {
    final author = (post['author'] ?? {}) as Map<String, dynamic>;
    final comments = (post['comments'] ?? []) as List;
    final liked = post['likedByMe'] == true;
    final isMine = post['authorId'] == _uid;
    final showComments = _openComments.contains(post['id']);
    _commentDrafts.putIfAbsent(post['id'], () => TextEditingController());

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: GlassCard(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    child: Text((author['name'] ?? 'M').toString().isNotEmpty
                        ? (author['name'] ?? 'M').toString()[0].toUpperCase()
                        : 'M'),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(author['name'] ?? 'Member',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text(
                          '${(author['role'] ?? '').toString().toUpperCase()} · ${_timeAgo(post['createdAt'])}',
                          style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                        ),
                      ],
                    ),
                  ),
                  if (isMine)
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18),
                      onPressed: () => _delete(post),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(post['content'] ?? '', style: const TextStyle(fontSize: 14, height: 1.4)),
              const SizedBox(height: 10),
              Row(
                children: [
                  TextButton.icon(
                    onPressed: () => _toggleLike(post),
                    icon: Icon(liked ? Icons.favorite : Icons.favorite_border,
                        size: 18, color: liked ? Colors.pinkAccent : null),
                    label: Text('${post['likeCount'] ?? 0}'),
                  ),
                  TextButton.icon(
                    onPressed: () => setState(() {
                      if (showComments) {
                        _openComments.remove(post['id']);
                      } else {
                        _openComments.add(post['id']);
                      }
                    }),
                    icon: const Icon(Icons.chat_bubble_outline, size: 18),
                    label: Text('${comments.length}'),
                  ),
                ],
              ),
              if (showComments) ...[
                const Divider(),
                ...comments.map((c) {
                  final cAuthor = (c['author'] ?? {}) as Map<String, dynamic>;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 12,
                          child: Text(
                            (cAuthor['name'] ?? 'M').toString().isNotEmpty
                                ? (cAuthor['name'] ?? 'M').toString()[0].toUpperCase()
                                : 'M',
                            style: const TextStyle(fontSize: 10),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(cAuthor['name'] ?? 'Member',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold, fontSize: 12)),
                              Text(c['text'] ?? '', style: const TextStyle(fontSize: 12)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _commentDrafts[post['id']],
                        maxLength: 500,
                        decoration: const InputDecoration(
                          hintText: 'Write a comment…',
                          counterText: '',
                          isDense: true,
                        ),
                        onSubmitted: (_) => _comment(post),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.send, size: 18),
                      onPressed: () => _comment(post),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
