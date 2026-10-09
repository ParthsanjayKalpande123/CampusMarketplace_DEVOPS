'use strict';

/**
 * src/models/User.js
 *
 * Mongoose schema for the users collection.
 *
 * Security rules enforced at schema level:
 *  - passwordHash: select: false — never returned by any query unless
 *    explicitly requested with .select('+passwordHash').
 *  - toJSON transform: strips passwordHash and __v from all serialized output.
 *  - Email: unique index, lowercase, trimmed.
 *
 * Password hashing is NOT done here. Hashing is the responsibility of
 * auth.service.js (business logic belongs in the service layer).
 */

const mongoose = require('mongoose');

const { Schema, Types } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long.'],
      maxlength: [100, 'Name cannot exceed 100 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email address is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        'Please provide a valid email address.',
      ],
    },

    /**
     * Only the bcrypt hash is stored — never the plaintext password.
     * select: false ensures this field is excluded from all queries
     * unless explicitly opted in with .select('+passwordHash').
     */
    passwordHash: {
      type: String,
      required: [true, 'Password is required.'],
      select: false,
    },

    phone: {
      type: String,
      trim: true,
      match: [
        /^[0-9+\-\s()]{7,20}$/,
        'Please provide a valid phone number.',
      ],
      default: null,
    },

    college: {
      type: String,
      trim: true,
      maxlength: [200, 'College name cannot exceed 200 characters.'],
      default: null,
    },

    collegeEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    department: {
      type: String,
      trim: true,
      maxlength: [120, 'Department cannot exceed 120 characters.'],
      default: null,
    },

    year: {
      type: String,
      trim: true,
      maxlength: [40, 'Year cannot exceed 40 characters.'],
      default: null,
    },

    collegeVerified: {
      type: Boolean,
      default: false,
    },

    interests: {
      type: [{ type: Types.ObjectId, ref: 'Category' }],
      default: [],
    },

    emailVerification: {
      tokenHash: { type: String, select: false, default: null },
      expiresAt: { type: Date, default: null },
    },

    /**
     * URL string only — no file uploads in Phase 1-6.
     * Architecture LOCK-17: imageUrl is a string; file upload
     * may be replaced with AWS S3 in a future phase.
     */
    profileImage: {
      type: String,
      trim: true,
      default: null,
    },

    role: {
      type: String,
      enum: {
        values: ['student', 'admin'],
        message: "Role must be 'student' or 'admin'.",
      },
      default: 'student',
    },

    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,

    /**
     * toJSON transform: applied whenever res.json() serialises a document.
     * Removes passwordHash and __v from every API response automatically.
     */
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ------------------------------------------------------------------
// Indexes
// ------------------------------------------------------------------

// email unique index is already created by unique: true in the schema.
// Adding a collation-insensitive index is not needed since we already
// lowercase the email before saving.

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// ------------------------------------------------------------------
// Instance methods
// ------------------------------------------------------------------

/**
 * Returns a plain object safe to include in API responses.
 * Equivalent to calling toJSON but useful when calling from services.
 *
 * @returns {object}
 */
userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toJSON();
  return obj;
};

// ------------------------------------------------------------------
// Model
// ------------------------------------------------------------------

const User = mongoose.model('User', userSchema);

module.exports = User;
