// OrbitControls implementation
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    
    this.minDistance = 5;
    this.maxDistance = 50;
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.rotateSpeed = 0.5;
    this.zoomSpeed = 1;
    
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    
    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();
    
    this.STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
    this.state = this.STATE.NONE;
    
    this.init();
  }
  
  init() {
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  onMouseDown(event) {
    event.preventDefault();
    
    if (event.button === 0) {
      this.state = this.STATE.ROTATE;
      this.rotateStart.set(event.clientX, event.clientY);
    } else if (event.button === 2) {
      this.state = this.STATE.PAN;
    }
    
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
  }
  
  onMouseMove(event) {
    event.preventDefault();
    
    if (this.state === this.STATE.ROTATE) {
      this.rotateEnd.set(event.clientX, event.clientY);
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
      
      const element = this.domElement;
      this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / element.clientHeight;
      this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / element.clientHeight;
      
      this.rotateStart.copy(this.rotateEnd);
    }
  }
  
  onMouseUp() {
    this.domElement.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.state = this.STATE.NONE;
  }
  
  onMouseWheel(event) {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.scale *= 0.95;
    } else if (event.deltaY > 0) {
      this.scale /= 0.95;
    }
  }
  
  update() {
    const offset = new THREE.Vector3();
    const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
    const quatInverse = quat.clone().invert();
    
    const position = this.camera.position;
    offset.copy(position).sub(this.target);
    offset.applyQuaternion(quat);
    
    this.spherical.setFromVector3(offset);
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;
    this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    
    this.target.add(this.panOffset);
    offset.setFromSpherical(this.spherical);
    offset.applyQuaternion(quatInverse);
    position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    
    if (this.enableDamping) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);
    }
    
    this.scale = 1;
    this.panOffset.set(0, 0, 0);
    
    return true;
  }
  
  dispose() {
    this.domElement.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.removeEventListener('wheel', this.onMouseWheel.bind(this));
  }
}

// Main application class
class VarietyMinimization {
  constructor() {
    this.variety = 0;
    this.numBodies = 8;
    this.learningRate = 0.05;
    this.simulationSpeed = 0.5;
    this.isPaused = false;
    this.autoRotate = false;
    this.theoreticalMin = 0;
    this.varietyWeight = 1.0;
    this.gravityWeight = 0.0;
    
    this.positions = [];
    this.velocities = [];
    this.particles = [];
    this.animationId = null;
    this.frameCounter = 0;
    
    // Dragging functionality
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.selectedParticle = null;
    this.dragPlane = new THREE.Plane();
    this.intersection = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    
    this.init();
  }
  
  init() {
    this.setupScene();
    this.setupControls();
    this.initializeBodies(this.numBodies);
    this.animate();
  }
  
  setupScene() {
    const container = document.getElementById('three-container');
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);
    
    // Fixed directional light from top-front-right
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.target.position.set(0, 0, 0);
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
    
    // Additional fixed directional light from opposite side for better illumination
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, -5, -5);
    directionalLight2.target.position.set(0, 0, 0);
    this.scene.add(directionalLight2);
    this.scene.add(directionalLight2.target);

    // Boundary box
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
    const boxEdges = new THREE.EdgesGeometry(boxGeometry);
    const boxLines = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ 
        color: 0x6666cc, 
        transparent: true, 
        opacity: 0.6,
        linewidth: 2
      })
    );
    this.scene.add(boxLines);
    
    // OrbitControls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    
    // Add mouse event listeners for dragging
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
    
    // Handle resize
    window.addEventListener('resize', () => this.handleResize());
  }
  
  setupControls() {
    // DOM elements
    this.elements = {
      pauseBtn: document.getElementById('pause-btn'),
      rotateBtn: document.getElementById('rotate-btn'),
      bodiesSlider: document.getElementById('bodies-slider'),
      bodiesValue: document.getElementById('bodies-value'),
      learningSlider: document.getElementById('learning-slider'),
      learningValue: document.getElementById('learning-value'),
      speedSlider: document.getElementById('speed-slider'),
      speedValue: document.getElementById('speed-value'),
      varietyValue: document.getElementById('variety-value'),
      theoreticalMin: document.getElementById('theoretical-min')
    };
    
    // Event listeners
    this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
    this.elements.rotateBtn.addEventListener('click', () => this.toggleAutoRotate());
    
    this.elements.bodiesSlider.addEventListener('input', (e) => {
      this.numBodies = parseInt(e.target.value);
      this.elements.bodiesValue.textContent = this.numBodies;
      this.initializeBodies(this.numBodies);
    });
    
    this.elements.learningSlider.addEventListener('input', (e) => {
      this.learningRate = parseFloat(e.target.value);
      this.elements.learningValue.textContent = this.learningRate.toFixed(2);
    });
    
    this.elements.speedSlider.addEventListener('input', (e) => {
      this.simulationSpeed = parseFloat(e.target.value);
      this.elements.speedValue.textContent = this.simulationSpeed.toFixed(1);
    });
  }
  
  onMouseDown(event) {
    // Only handle right mouse button for ball dragging
    if (event.button !== 2) return;
    
    // Prevent context menu
    event.preventDefault();
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.particles);
    
    if (intersects.length > 0) {
      // Disable orbit controls when dragging a particle
      this.controls.enabled = false;
      this.isDragging = true;
      this.selectedParticle = intersects[0].object;
      
      // Find the index of the selected particle
      this.selectedParticleIndex = this.particles.indexOf(this.selectedParticle);
      
      // Set up drag plane perpendicular to camera direction
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      this.dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, this.selectedParticle.position);
      
      // Calculate offset between mouse and particle center
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
        this.offset.copy(this.intersection).sub(this.selectedParticle.position);
      }
      
      // Visual feedback - make selected particle slightly larger and more transparent
      this.selectedParticle.scale.setScalar(1.2);
      this.selectedParticle.material.transparent = true;
      this.selectedParticle.material.opacity = 0.7;
    }
  }
  
  onMouseMove(event) {
    if (!this.isDragging || !this.selectedParticle) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
      const newPosition = this.intersection.clone().sub(this.offset);
      
      // Apply boundary constraints
      newPosition.x = Math.max(-10, Math.min(10, newPosition.x));
      newPosition.y = Math.max(-10, Math.min(10, newPosition.y));
      newPosition.z = Math.max(-10, Math.min(10, newPosition.z));
      
      // Update particle position
      this.selectedParticle.position.copy(newPosition);
      
      // Update the position in our physics array
      if (this.selectedParticleIndex !== -1) {
        this.positions[this.selectedParticleIndex].copy(newPosition);
        // Reset velocity when manually positioning
        this.velocities[this.selectedParticleIndex].set(0, 0, 0);
      }
    }
  }
  
  onMouseUp(event) {
    // Only handle right mouse button release
    if (event.button === 2 && this.isDragging && this.selectedParticle) {
      // Restore particle appearance
      this.selectedParticle.scale.setScalar(1.0);
      this.selectedParticle.material.transparent = false;
      this.selectedParticle.material.opacity = 1.0;
      
      // Re-enable orbit controls
      this.controls.enabled = true;
      this.isDragging = false;
      this.selectedParticle = null;
      this.selectedParticleIndex = -1;
    }
  }
  
  initializeBodies(n) {
    // Clear existing particles
    this.particles.forEach(p => this.scene.remove(p));
    this.particles.length = 0;
    this.positions = [];
    this.velocities = [];

    // Create new particles
    for (let i = 0; i < n; i++) {
      const geometry = new THREE.SphereGeometry(0.3, 32, 32);
      
      // More diverse color palette
      let color;
      const colorIndex = i % 12; // Cycle through 12 distinct colors
      switch (colorIndex) {
        case 0: color = new THREE.Color(0xff6b6b); break; // Red
        case 1: color = new THREE.Color(0x4ecdc4); break; // Teal
        case 2: color = new THREE.Color(0x45b7d1); break; // Blue
        case 3: color = new THREE.Color(0xf9ca24); break; // Yellow
        case 4: color = new THREE.Color(0x6c5ce7); break; // Purple
        case 5: color = new THREE.Color(0xa29bfe); break; // Light Purple
        case 6: color = new THREE.Color(0xfd79a8); break; // Pink
        case 7: color = new THREE.Color(0x00b894); break; // Green
        case 8: color = new THREE.Color(0xe17055); break; // Orange
        case 9: color = new THREE.Color(0x74b9ff); break; // Light Blue
        case 10: color = new THREE.Color(0x55a3ff); break; // Sky Blue
        default: color = new THREE.Color(0xfdcb6e); break; // Peach
      }
      
      const material = new THREE.MeshPhongMaterial({
        color: color,
        shininess: 100,
        specular: 0x222222
      });
      const sphere = new THREE.Mesh(geometry, material);
      
      // Random initial position
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16
      );
      sphere.position.copy(pos);
      
      this.positions.push(pos);
      this.velocities.push(new THREE.Vector3(0, 0, 0));
      this.particles.push(sphere);
      this.scene.add(sphere);
    }
    
    // Calculate theoretical minimum: n^(3/2) where n is number of pairwise distances
    const R = (this.numBodies * (this.numBodies - 1)) / 2;
    this.theoreticalMin = Math.pow(R, 1.5);
    this.elements.theoreticalMin.textContent = this.theoreticalMin.toFixed(2);
  }
  
  calculateVarietyAndGradient() {
    const n = this.positions.length;
    const distances = [];
    const R = (n * (n - 1)) / 2;
    
    // Calculate all pairwise distances
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = this.positions[i].distanceTo(this.positions[j]);
        distances.push({ dist, i, j });
      }
    }
    
    // Calculate variety V = sqrt(Σr²) · Σ(1/r)
    let sumSqDist = 0;
    let sumInvDist = 0;
    
    distances.forEach(({ dist }) => {
      const safeDist = Math.max(dist, 0.1); // Avoid division by zero
      sumSqDist += safeDist * safeDist;
      sumInvDist += 1 / safeDist;
    });
    
    const variety = Math.sqrt(sumSqDist) * sumInvDist;
    
    // Calculate gradient for MINIMIZATION (negative gradient descent)
    const gradients = this.positions.map(() => new THREE.Vector3(0, 0, 0));
    
    const sqrtSumSq = Math.sqrt(sumSqDist);
    
    distances.forEach(({ dist, i, j }) => {
      const safeDist = Math.max(dist, 0.1);
      const dir = new THREE.Vector3().subVectors(this.positions[i], this.positions[j]);
      dir.normalize();
      
      // Derivative of V with respect to distance r_ij
      const dV_dr = (safeDist / sqrtSumSq) * sumInvDist - sqrtSumSq / (safeDist * safeDist);
      
      // For MINIMIZATION, we negate the gradient direction
      const grad = dir.multiplyScalar(-dV_dr);
      
      gradients[i].add(grad);
      gradients[j].sub(grad);
    });
    
    return { variety, gradients };
  }
  
  togglePause() {
    this.isPaused = !this.isPaused;
    this.elements.pauseBtn.textContent = this.isPaused ? '▶' : '⏸';
  }
  
  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.autoRotate) {
      this.elements.rotateBtn.classList.remove('btn-gray');
      this.elements.rotateBtn.classList.add('btn-purple');
    } else {
      this.elements.rotateBtn.classList.remove('btn-purple');
      this.elements.rotateBtn.classList.add('btn-gray');
    }
  }
  
  handleResize() {
    const container = document.getElementById('three-container');
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }
  
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (!this.isPaused) {
      this.frameCounter += this.simulationSpeed;
      
        // Only run simulation when frameCounter >= 1
        while (this.frameCounter >= 1) {
          const { variety: currentVariety, gradients } = this.calculateVarietyAndGradient();
          this.variety = currentVariety;
          this.elements.varietyValue.textContent = currentVariety.toFixed(2);

          // Update positions using gradient descent (MINIMIZATION)
          this.positions.forEach((pos, i) => {
            // Skip updating the particle being dragged
            if (this.isDragging && i === this.selectedParticleIndex) {
              return;
            }
            
            // Add gradient to velocity with damping
            this.velocities[i].multiplyScalar(0.9);
            // Note: gradients are already negated for minimization
            this.velocities[i].addScaledVector(gradients[i], this.learningRate);
            
            // Update position
            pos.add(this.velocities[i]);
            
            // Boundary constraints with soft bounce
            ['x', 'y', 'z'].forEach(axis => {
              if (pos[axis] > 10) {
                pos[axis] = 10;
                this.velocities[i][axis] *= -0.5;
              } else if (pos[axis] < -10) {
                pos[axis] = -10;
                this.velocities[i][axis] *= -0.5;
              }
            });
            
            this.particles[i].position.copy(pos);
          });        this.frameCounter -= 1;
      }
    }

    // Update controls
    this.controls.update();

    // Rotate camera slowly if autoRotate is enabled
    if (this.autoRotate) {
      const time = Date.now() * 0.0001;
      this.camera.position.x = Math.cos(time) * 15;
      this.camera.position.z = Math.sin(time) * 15;
      this.camera.lookAt(0, 0, 0);
    }

    this.renderer.render(this.scene, this.camera);
  }
  
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      // Remove mouse event listeners
      this.renderer.domElement.removeEventListener('mousedown', (e) => this.onMouseDown(e));
      this.renderer.domElement.removeEventListener('mousemove', (e) => this.onMouseMove(e));
      this.renderer.domElement.removeEventListener('mouseup', (e) => this.onMouseUp(e));
      this.renderer.dispose();
    }
    window.removeEventListener('resize', () => this.handleResize());
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new VarietyMinimization();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
});