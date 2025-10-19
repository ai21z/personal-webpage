/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NOTEBOOK CONTACT FORM — NECROGRAPHIC AESTHETIC
   Aged notebook page with living mycelium network animation
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class NotebookContact {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrame = null;
    this.moldSpots = [];
    this.isVisible = false;
    this.lastFrame = 0;
    this.FPS = 20; // Subtle, slow animation
    this.frameInterval = 1000 / this.FPS;
  }

  init() {
    this.canvas = document.getElementById('notebook-mycelium');
    if (!this.canvas) return;

    // Canvas disabled - using only static CSS coffee stains
    // this.ctx = this.canvas.getContext('2d');
    // this.setupCanvas();
    // this.generateMoldNetwork();
    this.setupValidation();
    // this.setupAnimations();
    // this.startAnimation();

    // Resize handler removed since canvas is disabled
  }

  setupCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  generateMoldNetwork() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const spotCount = 12 + Math.floor(Math.random() * 7); // 12-18 spots
    const minDistance = 180; // Minimum distance between spots

    this.moldSpots = [];

    for (let i = 0; i < spotCount; i++) {
      let attempts = 0;
      let spot = null;

      // Try to find a valid position
      while (attempts < 30) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const radius = 8 + Math.random() * 16; // 8-24px radius
        const pulseSpeed = 0.5 + Math.random() * 1.5;
        const pulsePhase = Math.random() * Math.PI * 2;
        
        // Irregular shape parameters for coffee stain effect
        const radiusX = radius * (0.7 + Math.random() * 0.6); // Elliptical
        const radiusY = radius * (0.7 + Math.random() * 0.6);
        const rotation = Math.random() * Math.PI;
        const irregularity = 0.2 + Math.random() * 0.3; // How "blobby" it is

        // Check distance from other spots
        let valid = true;
        for (const existing of this.moldSpots) {
          const dist = Math.hypot(x - existing.x, y - existing.y);
          if (dist < minDistance) {
            valid = false;
            break;
          }
        }

        if (valid) {
          spot = { x, y, radius, radiusX, radiusY, rotation, irregularity, pulseSpeed, pulsePhase };
          break;
        }
        attempts++;
      }

      if (spot) {
        this.moldSpots.push(spot);
      }
    }

    // Generate connections between nearby spots
    for (const spot of this.moldSpots) {
      spot.connections = [];
      for (const other of this.moldSpots) {
        if (spot === other) continue;
        const dist = Math.hypot(spot.x - other.x, spot.y - other.y);
        if (dist < minDistance) {
          spot.connections.push(other);
        }
      }
    }
  }

  drawMoldNetwork(timestamp) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const time = timestamp * 0.001; // Convert to seconds

    // Draw mycelium connections first (behind spots)
    ctx.strokeStyle = 'rgba(139, 125, 107, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);

    for (const spot of this.moldSpots) {
      for (const other of spot.connections) {
        // Subtle growth animation
        const growthPhase = (time * 0.2 + spot.pulsePhase) % 1;
        ctx.globalAlpha = 0.2 + growthPhase * 0.3;

        ctx.beginPath();
        ctx.moveTo(spot.x, spot.y);

        // Slightly curved path
        const midX = (spot.x + other.x) / 2 + (Math.sin(time * 0.5 + spot.pulsePhase) * 5);
        const midY = (spot.y + other.y) / 2 + (Math.cos(time * 0.5 + spot.pulsePhase) * 5);
        ctx.quadraticCurveTo(midX, midY, other.x, other.y);

        ctx.stroke();
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Draw mold spots with pulsing effect - irregular coffee stain shapes
    for (const spot of this.moldSpots) {
      const pulse = Math.sin(time * spot.pulseSpeed + spot.pulsePhase) * 0.5 + 0.5;
      const currentRadiusX = spot.radiusX * (0.85 + pulse * 0.15);
      const currentRadiusY = spot.radiusY * (0.85 + pulse * 0.15);
      const opacity = 0.15 + pulse * 0.1;

      ctx.save();
      ctx.translate(spot.x, spot.y);
      ctx.rotate(spot.rotation);

      // Draw irregular coffee stain using multiple overlapping ellipses
      const blobCount = 3 + Math.floor(spot.irregularity * 5); // 3-5 blobs
      for (let i = 0; i < blobCount; i++) {
        const angle = (Math.PI * 2 * i) / blobCount + time * 0.1;
        const offsetX = Math.cos(angle) * currentRadiusX * spot.irregularity;
        const offsetY = Math.sin(angle) * currentRadiusY * spot.irregularity;
        const blobRadiusX = currentRadiusX * (0.6 + Math.random() * 0.4);
        const blobRadiusY = currentRadiusY * (0.6 + Math.random() * 0.4);

        // Outer glow for coffee stain effect
        const gradient = ctx.createRadialGradient(
          offsetX, offsetY, 0,
          offsetX, offsetY, Math.max(blobRadiusX, blobRadiusY) * 1.5
        );
        gradient.addColorStop(0, `rgba(101, 67, 33, ${opacity * 0.9})`);
        gradient.addColorStop(0.4, `rgba(101, 67, 33, ${opacity * 0.5})`);
        gradient.addColorStop(0.7, `rgba(139, 125, 107, ${opacity * 0.3})`);
        gradient.addColorStop(1, 'rgba(139, 125, 107, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(offsetX, offsetY, blobRadiusX * 1.5, blobRadiusY * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core stain with irregular edges
      ctx.fillStyle = `rgba(101, 67, 33, ${opacity + 0.15})`;
      ctx.beginPath();
      
      // Create irregular blob shape
      const points = 8 + Math.floor(spot.irregularity * 8);
      for (let i = 0; i <= points; i++) {
        const angle = (Math.PI * 2 * i) / points;
        const randomness = 0.7 + Math.random() * 0.6; // Irregular edge
        const rx = currentRadiusX * randomness;
        const ry = currentRadiusY * randomness;
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();

      // Add some darker speckles within the stain for realism
      if (Math.random() < 0.3) {
        ctx.fillStyle = `rgba(80, 50, 25, ${opacity * 0.6})`;
        const speckleX = (Math.random() - 0.5) * currentRadiusX * 0.5;
        const speckleY = (Math.random() - 0.5) * currentRadiusY * 0.5;
        ctx.beginPath();
        ctx.arc(speckleX, speckleY, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  startAnimation() {
    const animate = (timestamp) => {
      if (!this.isVisible) {
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }

      // Throttle to target FPS
      const elapsed = timestamp - this.lastFrame;
      if (elapsed > this.frameInterval) {
        this.lastFrame = timestamp - (elapsed % this.frameInterval);
        this.drawMoldNetwork(timestamp);
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  setupValidation() {
    const form = document.getElementById('contact-form');
    const emailInput = document.getElementById('email');
    const subjectInput = document.getElementById('subject');
    const messageInput = document.getElementById('message');
    const submitBtn = document.querySelector('.notebook-submit');

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateField = (input, validator, errorMsg) => {
      const error = input.nextElementSibling;
      if (validator(input.value)) {
        input.classList.remove('error');
        error.textContent = '';
        return true;
      } else {
        input.classList.add('error');
        error.textContent = errorMsg;
        return false;
      }
    };

    // Character counter for message
    const charCount = document.querySelector('.char-count');
    messageInput.addEventListener('input', () => {
      const len = messageInput.value.length;
      charCount.textContent = `${len}/350`;
      if (len > 350) {
        charCount.style.color = '#8B0000';
      } else if (len < 10) {
        charCount.style.color = '#8B7D6B';
      } else {
        charCount.style.color = '#5A5040';
      }
    });

    // Real-time validation
    emailInput.addEventListener('blur', () => {
      if (emailInput.value) {
        validateField(
          emailInput,
          val => emailRegex.test(val),
          'Please enter a valid email address'
        );
      }
    });

    subjectInput.addEventListener('blur', () => {
      if (subjectInput.value) {
        validateField(
          subjectInput,
          val => val.length >= 5 && val.length <= 60,
          'Subject must be 5-60 characters'
        );
      }
    });

    messageInput.addEventListener('blur', () => {
      if (messageInput.value) {
        validateField(
          messageInput,
          val => val.length >= 10 && val.length <= 350,
          'Message must be 10-350 characters'
        );
      }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validate all fields
      const isEmailValid = validateField(
        emailInput,
        val => emailRegex.test(val),
        'Please enter a valid email address'
      );

      const isSubjectValid = validateField(
        subjectInput,
        val => val.length >= 5 && val.length <= 60,
        'Subject must be 5-60 characters'
      );

      const isMessageValid = validateField(
        messageInput,
        val => val.length >= 10 && val.length <= 350,
        'Message must be 10-350 characters'
      );

      if (!isEmailValid || !isSubjectValid || !isMessageValid) {
        return;
      }

      // Disable submit button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      try {
        // Here you would normally send to your backend
        // For now, just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Success feedback
        form.innerHTML = `
          <div class="notebook-success">
            <p class="notebook-lines">Message sent successfully!</p>
            <p class="notebook-lines" style="margin-top: 1rem;">I'll get back to you soon.</p>
          </div>
        `;
      } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
        alert('Failed to send message. Please try again.');
      }
    });
  }

  setupAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          this.isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.1 }
    );

    const contactSection = document.getElementById('contact');
    if (contactSection) {
      observer.observe(contactSection);
    }
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

// Export singleton instance
export const notebookContact = new NotebookContact();
