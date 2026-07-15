import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

/// Ecosystem Network — directory, pending invites, and connections.
/// Reads through the backend API (Admin SDK), matching the web implementation.
class NetworkPage extends StatefulWidget {
  const NetworkPage({super.key});

  @override
  State<NetworkPage> createState() => _NetworkPageState();
}

class _NetworkPageState extends State<NetworkPage> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  List<dynamic> _directory = [];
  List<dynamic> _connections = [];
  bool _isLoading = true;
  String? _busyId;
  final TextEditingController _search = TextEditingController();

  String get _uid => FirebaseAuth.instance.currentUser?.uid ?? '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      fetchDirectory(search: _search.text.trim()),
      fetchConnections(),
    ]);
    if (mounted) {
      setState(() {
        _directory = results[0];
        _connections = results[1];
        _isLoading = false;
      });
    }
  }

  Map<String, dynamic> _connectionState(String targetUid) {
    for (final c in _connections) {
      if ((c['senderId'] == _uid && c['receiverId'] == targetUid) ||
          (c['senderId'] == targetUid && c['receiverId'] == _uid)) {
        return {
          'status': c['status'],
          'id': c['id'],
          'isSender': c['senderId'] == _uid,
        };
      }
    }
    return {'status': 'none', 'id': null, 'isSender': false};
  }

  Future<void> _connect(String targetUid) async {
    setState(() => _busyId = targetUid);
    final error = await sendConnectionRequest(targetUid);
    if (mounted) {
      setState(() => _busyId = null);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error ?? 'Connection invitation sent!'),
      ));
      if (error == null) _load();
    }
  }

  Future<void> _respond(String connectionId, String status) async {
    setState(() => _busyId = connectionId);
    final error = await respondToConnection(connectionId, status);
    if (mounted) {
      setState(() => _busyId = null);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error ?? (status == 'accepted' ? 'Request accepted!' : 'Request declined.')),
      ));
      if (error == null) _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _connections
        .where((c) => c['receiverId'] == _uid && c['status'] == 'pending')
        .toList();
    final accepted = _connections.where((c) => c['status'] == 'accepted').toList();

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Network',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: 'Search by name or email…',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onSubmitted: (_) => _load(),
                ),
              ],
            ),
          ),
          TabBar(
            controller: _tabs,
            tabs: [
              Tab(text: 'Directory (${_directory.length})'),
              Tab(text: 'Pending (${pending.length})'),
              Tab(text: 'Connected (${accepted.length})'),
            ],
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabs,
                    children: [
                      _buildDirectory(),
                      _buildPending(pending),
                      _buildConnections(accepted),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildDirectory() {
    if (_directory.isEmpty) {
      return const Center(child: Text('No users found.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _directory.length,
        itemBuilder: (context, i) {
          final user = _directory[i] as Map<String, dynamic>;
          final conn = _connectionState(user['uid'] ?? '');
          final status = conn['status'];

          Widget action;
          if (status == 'accepted') {
            action = const Chip(label: Text('Connected', style: TextStyle(fontSize: 11)));
          } else if (status == 'pending' && conn['isSender'] == true) {
            action = const Chip(label: Text('Pending', style: TextStyle(fontSize: 11)));
          } else if (status == 'pending') {
            action = FilledButton(
              onPressed: _busyId == conn['id'] ? null : () => _respond(conn['id'], 'accepted'),
              child: const Text('Accept'),
            );
          } else {
            action = OutlinedButton(
              onPressed: _busyId == user['uid'] ? null : () => _connect(user['uid'] ?? ''),
              child: const Text('Connect'),
            );
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: ListTile(
                leading: CircleAvatar(
                  child: Text((user['fullName'] ?? 'M').toString().isNotEmpty
                      ? (user['fullName'] ?? 'M').toString()[0].toUpperCase()
                      : 'M'),
                ),
                title: Text(user['fullName'] ?? 'Member',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                subtitle: Text(
                  '${(user['role'] ?? '').toString().toUpperCase()}${(user['email'] ?? '').toString().isNotEmpty ? ' · ${user['email']}' : ''}',
                  style: const TextStyle(fontSize: 11),
                ),
                trailing: action,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildPending(List<dynamic> pending) {
    if (pending.isEmpty) {
      return const Center(child: Text('No pending invitations.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: pending.length,
      itemBuilder: (context, i) {
        final c = pending[i] as Map<String, dynamic>;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: GlassCard(
            child: ListTile(
              leading: CircleAvatar(
                child: Text((c['senderName'] ?? '?').toString().isNotEmpty
                    ? (c['senderName'] ?? '?').toString()[0].toUpperCase()
                    : '?'),
              ),
              title: Text(c['senderName'] ?? 'Member',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: Text(c['senderRole'] ?? '', style: const TextStyle(fontSize: 11)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.check_circle, color: Colors.green),
                    onPressed: _busyId == c['id'] ? null : () => _respond(c['id'], 'accepted'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.cancel_outlined, color: Colors.redAccent),
                    onPressed: _busyId == c['id'] ? null : () => _respond(c['id'], 'declined'),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildConnections(List<dynamic> accepted) {
    if (accepted.isEmpty) {
      return const Center(child: Text('No connections yet — start in the Directory tab.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: accepted.length,
      itemBuilder: (context, i) {
        final c = accepted[i] as Map<String, dynamic>;
        final otherName = c['senderId'] == _uid
            ? (c['receiverName'] ?? 'Member')
            : (c['senderName'] ?? 'Member');
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: GlassCard(
            child: ListTile(
              leading: CircleAvatar(
                child: Text(otherName.toString().isNotEmpty
                    ? otherName.toString()[0].toUpperCase()
                    : 'M'),
              ),
              title: Text(otherName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: const Text('Connected', style: TextStyle(fontSize: 11)),
            ),
          ),
        );
      },
    );
  }
}
