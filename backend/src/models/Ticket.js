const crypto = require('crypto');
const mongoose = require('mongoose');

const CATEGORIES = ['vr_tour', 'download', 'website', 'other'];
const PLATFORMS = ['vr', 'pc', 'android', 'website', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved'];
// A browser keeps one key per ticket; each "find my ticket" on a new device adds
// another. Capped so a lookup loop can't grow the document forever.
const MAX_KEYS = 10;

// No 0/O, 1/I/L - the reference code gets read out and typed by people.
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const messageSchema = new mongoose.Schema(
  {
    author: { type: String, enum: ['visitor', 'staff'], required: true },
    staffName: { type: String, trim: true, maxlength: 100 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/**
 * Support ticket from the landing page's help widget.
 *
 * Visitors don't have accounts. Instead each ticket has a random access key
 * that their browser stores; only a SHA-256 hash of it is kept here, so a
 * database leak doesn't hand out working keys.
 */
const ticketSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true },
    keyHashes: { type: [String], select: false, default: [] },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    category: { type: String, enum: CATEGORIES, required: true },
    platform: { type: String, enum: PLATFORMS },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: STATUSES, default: 'open' },
    messages: { type: [messageSchema], default: [] },
    // Who spoke last - drives "needs a reply" for staff and unread dots for visitors.
    lastMessageBy: { type: String, enum: ['visitor', 'staff'], default: 'visitor' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, lastMessageAt: -1 });

ticketSchema.statics.hashKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

ticketSchema.statics.newKey = () => crypto.randomBytes(24).toString('hex');

ticketSchema.statics.newRef = () => {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) code += REF_ALPHABET[b % REF_ALPHABET.length];
  return `VC-${code}`;
};

/** Adds a message and keeps the "last spoke" fields in step. */
ticketSchema.methods.addMessage = function addMessage(author, body, staffName) {
  this.messages.push({ author, body, staffName });
  this.lastMessageBy = author;
  this.lastMessageAt = new Date();
};

/** What a visitor may see - never the key hashes. */
ticketSchema.methods.toVisitorJSON = function toVisitorJSON() {
  return {
    ref: this.ref,
    name: this.name,
    email: this.email,
    category: this.category,
    platform: this.platform,
    subject: this.subject,
    status: this.status,
    messages: this.messages.map((m) => ({
      author: m.author,
      staffName: m.staffName,
      body: m.body,
      createdAt: m.createdAt,
    })),
    lastMessageBy: this.lastMessageBy,
    lastMessageAt: this.lastMessageAt,
    createdAt: this.createdAt,
  };
};

const Ticket = mongoose.model('Ticket', ticketSchema);
Ticket.CATEGORIES = CATEGORIES;
Ticket.PLATFORMS = PLATFORMS;
Ticket.STATUSES = STATUSES;
Ticket.MAX_KEYS = MAX_KEYS;
module.exports = Ticket;
