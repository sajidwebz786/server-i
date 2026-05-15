const { SupportTicket, SupportReply, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

exports.create = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.create({ userId: req.user.id, ...req.body });
  res.status(201).json({ ticket });
});

exports.myTickets = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.findAll({
    where: { userId: req.user.id },
    include: [{ model: SupportReply, as: 'replies', include: [{ model: User, as: 'user' }] }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ tickets });
});

exports.adminTickets = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.findAll({
    where: req.query.status ? { status: req.query.status } : {},
    include: [{ model: User, as: 'user' }, { model: SupportReply, as: 'replies' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ tickets });
});

exports.reply = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findByPk(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (req.user.role !== 'admin' && ticket.userId !== req.user.id) throw new ApiError(403, 'Ticket access denied');

  const reply = await SupportReply.create({
    ticketId: ticket.id,
    userId: req.user.id,
    message: req.body.message,
    isAdminReply: req.user.role === 'admin'
  });
  await ticket.update({ status: req.user.role === 'admin' ? 'answered' : 'open' });
  res.status(201).json({ reply });
});

exports.close = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findByPk(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (req.user.role !== 'admin' && ticket.userId !== req.user.id) throw new ApiError(403, 'Ticket access denied');
  await ticket.update({ status: 'closed' });
  res.json({ ticket });
});
