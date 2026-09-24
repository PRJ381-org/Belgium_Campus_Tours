const Ticket = require('../models/Ticket');
const asyncHandler = require('../utils/asyncHandler');

const MAX_TICKETS_PER_BROWSER = 20;

const notFound = (res) =>
  res.status(404).json({ success: false, message: 'Ticket not found, or this browser no longer has access to it.' });

/** Finds a ticket only if `key` is one of its access keys. */
async function findWithKey(ref, key) {
  if (!ref || !key) return null;
  return Ticket.findOne({ ref: String(ref).toUpperCase(), keyHashes: Ticket.hashKey(key) });
}

// ---------- Visitor (public, key-based) ----------

// POST /api/tickets -> open a ticket from the landing page widget
exports.createTicket = asyncHandler(async (req, res) => {
  // Honeypot field - see the widget. Pretend it worked, store nothing.
  if (req.body.website) {
    return res.status(201).json({ success: true });
  }

  const { name, email, category, platform, subject, message } = req.body;
  const key = Ticket.newKey();

  // Refs are random, so a clash is vanishingly rare - retry just in case.
  let ticket;
  for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
    try {
      const draft = new Ticket({
        ref: Ticket.newRef(),
        keyHashes: [Ticket.hashKey(key)],
        name,
        email,
        category,
        platform: platform || undefined,
        subject,
      });
      draft.addMessage('visitor', message);
      ticket = await draft.save();
    } catch (err) {
      if (err.code !== 11000) throw err; // only retry duplicate-ref errors
    }
  }
  if (!ticket) throw new Error('Could not create a ticket reference. Please try again.');

  res.status(201).json({ success: true, ref: ticket.ref, key, ticket: ticket.toVisitorJSON() });
});

// POST /api/tickets/mine -> the tickets this browser holds keys for
exports.myTickets = asyncHandler(async (req, res) => {
  const pairs = (Array.isArray(req.body.tickets) ? req.body.tickets : [])
    .filter((t) => t && typeof t.ref === 'string' && typeof t.key === 'string')
    .slice(0, MAX_TICKETS_PER_BROWSER);

  const found = await Ticket.find({ ref: { $in: pairs.map((p) => p.ref.toUpperCase()) } }).select('+keyHashes');
  const byRef = new Map(found.map((t) => [t.ref, t]));

  const tickets = pairs
    .map((p) => {
      const t = byRef.get(p.ref.toUpperCase());
      return t && t.keyHashes.includes(Ticket.hashKey(p.key)) ? t.toVisitorJSON() : null;
    })
    .filter(Boolean);

  res.json({ success: true, tickets });
});

// POST /api/tickets/:ref/messages -> visitor replies on their own ticket
exports.visitorReply = asyncHandler(async (req, res) => {
  const ticket = await findWithKey(req.params.ref, req.body.key);
  if (!ticket) return notFound(res);

  // Writing back on a resolved ticket means it isn't resolved any more.
  if (ticket.status === 'resolved') ticket.status = 'open';
  ticket.addMessage('visitor', req.body.message);
  await ticket.save();
  res.json({ success: true, ticket: ticket.toVisitorJSON() });
});

// POST /api/tickets/lookup -> "find my ticket" on a new browser (ref + email)
exports.lookupTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ ref: req.body.ref, email: req.body.email }).select('+keyHashes');
  if (!ticket) {
    return res
      .status(404)
      .json({ success: false, message: "We couldn't find a ticket with that reference and email. Check both and try again." });
  }

  // Give this browser its own key rather than revealing an existing one.
  const key = Ticket.newKey();
  ticket.keyHashes = [...ticket.keyHashes, Ticket.hashKey(key)].slice(-Ticket.MAX_KEYS);
  await ticket.save();
  res.json({ success: true, ref: ticket.ref, key, ticket: ticket.toVisitorJSON() });
});

// ---------- Staff (dashboard, admin/master) ----------

// GET /api/tickets -> all tickets, most recent activity first
exports.listTickets = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const tickets = await Ticket.find().sort({ lastMessageAt: -1 }).limit(limit);
  res.json({ success: true, count: tickets.length, tickets });
});

// GET /api/tickets/stats -> counts for the sidebar badge
exports.ticketStats = asyncHandler(async (req, res) => {
  const [open, inProgress, resolved, needsReply] = await Promise.all([
    Ticket.countDocuments({ status: 'open' }),
    Ticket.countDocuments({ status: 'in_progress' }),
    Ticket.countDocuments({ status: 'resolved' }),
    Ticket.countDocuments({ status: { $ne: 'resolved' }, lastMessageBy: 'visitor' }),
  ]);
  res.json({ success: true, open, inProgress, resolved, needsReply });
});

// POST /api/tickets/:ref/reply -> staff reply
exports.staffReply = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ ref: req.params.ref.toUpperCase() });
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

  const staffName = req.user.name || (req.user.email || '').split('@')[0] || 'Support';
  if (ticket.status === 'open') ticket.status = 'in_progress';
  ticket.addMessage('staff', req.body.message, staffName);
  await ticket.save();
  res.json({ success: true, ticket });
});

// PATCH /api/tickets/:ref/status -> open / in_progress / resolved
exports.setStatus = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOneAndUpdate(
    { ref: req.params.ref.toUpperCase() },
    { status: req.body.status },
    { new: true }
  );
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  res.json({ success: true, ticket });
});
