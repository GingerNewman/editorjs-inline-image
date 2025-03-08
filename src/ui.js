import { make, createImageCredits } from './helpers';
import Tunes from './tunes';
import ControlPanel from './controlPanel';
import bgIcon from '../assets/backgroundIcon.svg';
import borderIcon from '../assets/borderIcon.svg';
import stretchedIcon from '../assets/toolboxIcon.svg';
import dimensionIcon from '../assets/dimensionIcon.svg';
import ModalHandler from './modalHandler';

/**
 * Class for working with UI:
 *  - rendering base structure
 *  - show/hide preview
 *  - apply tune view
 */
export default class Ui {
  /**
   * @param {{api: object, config: object, readOnly: Boolean,
   *   onAddImageData: Function, onTuneToggled: Function}}
   *   api - Editorjs API
   *   config - Tool custom config
   *   readOnly - read-only mode flag
   *   onAddImageData - Callback for adding image data
   *   onTuneToggled - Callback for updating tunes data
   */
  constructor({
    api, config, readOnly, onAddImageData, onTuneToggled, onResize,
  }) {
    this.api = api;
    this.config = config;
    this.readOnly = readOnly;
    this.onAddImageData = onAddImageData;
    this.onTuneToggled = onTuneToggled;
    this.onResize = onResize;

    this.CSS = {
      baseClass: this.api.styles.block,
      loading: this.api.styles.loader,
      input: this.api.styles.input,
      wrapper: 'inline-image',
      imageHolder: 'inline-image__picture',
      caption: 'inline-image__caption',
    };

    this.settings = [
      {
        name: 'withBorder',
        icon: borderIcon,
      },
      {
        name: 'stretched',
        icon: stretchedIcon,
      },
      {
        name: 'withBackground',
        icon: bgIcon,
      },
      {
        name: 'size',
        icon: dimensionIcon,
      },
    ];

    this.controlPanel = new ControlPanel({
      api,
      config,
      readOnly,
      cssClasses: this.CSS,
      onSelectImage: (imageData) => this.selectImage(imageData),
    });

    this.tunes = new Tunes({
      cssClasses: {
        settingsButton: this.api.styles.settingsButton,
        settingsButtonActive: this.api.styles.settingsButtonActive,
      },
      settings: this.settings,
      onTuneToggled,
    });

    this.nodes = {
      wrapper: null,
      loader: null,
      imageHolder: null,
      image: null,
      caption: null,
      credits: null,
    };

    this.modal = new ModalHandler();
  }

  /**
   * Renders tool UI
   *
   * @param {Object} data Saved tool data
   * @returns {HTMLDivElement}
   */
  render(data) {
    const wrapper = make('div', [this.CSS.baseClass, this.CSS.wrapper]);
    const loader = make('div', this.CSS.loading);
    const image = make('img', '', {
      onload: () => this.onImageLoad(),
      onerror: () => this.onImageLoadError(),
    });
    const caption = make('div', [this.CSS.input, this.CSS.caption], {
      contentEditable: !this.readOnly,
      innerHTML: data.caption || '',
    });
    this.nodes.imageHolder = make('div', this.CSS.imageHolder);

    caption.dataset.placeholder = 'Enter a caption';

    if (data.url) {
      wrapper.appendChild(loader);
      image.src = data.url;
      this.buildImageCredits(data);
    } else {
      const controlPanelWrapper = this.controlPanel.render();
      this.nodes.controlPanelWrapper = controlPanelWrapper;
      wrapper.appendChild(controlPanelWrapper);
    }

    this.nodes.wrapper = wrapper;
    this.nodes.loader = loader;
    this.nodes.image = image;
    this.nodes.caption = caption;

    this.applySettings(data);

    this.setEvents();

    return wrapper;
  }

  /**
   * Builds Unsplash image credits element
   *
   * @param {Object} imageData Tool data
   * @returns {HTMLDivElement}
   */
  buildImageCredits(imageData) {
    const unsplashData = imageData.unsplash;
    if (unsplashData && unsplashData.author && unsplashData.profileLink) {
      const { appName } = this.config.unsplash;
      const credits = createImageCredits({ ...unsplashData, appName });
      this.nodes.imageHolder.appendChild(credits);
      this.nodes.credits = credits;
    }
  }

  /**
   * Creates and attaches resize handles to the image holder
   *
   * @returns {void}
   */
  addResizeHandles() {
    if (this.readOnly) return;

    // Ensure any existing handles are removed
    const existingHandles = this.nodes.imageHolder.querySelectorAll('.inline-image__resize-handle');
    existingHandles.forEach((handle) => handle.remove());

    // Create left and right resize handles
    const leftHandle = make('div', ['inline-image__resize-handle', 'inline-image__resize-handle--left']);
    const rightHandle = make('div', ['inline-image__resize-handle', 'inline-image__resize-handle--right']);

    // Attach resize event handlers to both handles
    this.attachResizeEvents(leftHandle);
    this.attachResizeEvents(rightHandle);

    // Add the handles to the image holder
    this.nodes.imageHolder.appendChild(leftHandle);
    this.nodes.imageHolder.appendChild(rightHandle);

    // Store handles reference
    this.nodes.leftHandle = leftHandle;
    this.nodes.rightHandle = rightHandle;
  }

  /**
   * Attach resize event handlers to a handle element
   *
   * @param {HTMLElement} handle - The resize handle element
   * @returns {void}
   */
  attachResizeEvents(handle) {
    let startX; let initialWidth; let
      aspectRatio;

    const onMouseMove = (event) => {
      // Calculate how much the mouse has moved horizontally
      const deltaX = handle.classList.contains('inline-image__resize-handle--right')
        ? event.clientX - startX
        : startX - event.clientX;

      // Get the editor width for constraint
      const editorWidth = this.nodes.wrapper.closest('.codex-editor__redactor').offsetWidth - 40; // Subtract padding

      // Calculate new width with constraints
      let newWidth = Math.max(50, initialWidth + deltaX);
      newWidth = Math.min(newWidth, editorWidth); // Prevent exceeding editor width

      // Calculate new height based on aspect ratio
      const newHeight = Math.round(newWidth / aspectRatio);

      // Apply new dimensions to the image
      this.nodes.image.style.width = `${newWidth}px`;
      this.nodes.image.style.height = `${newHeight}px`;

      // Prevent any text selection during resize
      window.getSelection().removeAllRanges();
    };

    const onMouseUp = () => {
      // Remove event listeners when done
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('image-resizing');

      // Store the current dimensions for saving
      const dimensions = {
        width: this.nodes.image.offsetWidth,
        height: this.nodes.image.offsetHeight,
      };

      // Update the data
      this.onImageResize(dimensions);
    };

    const onMouseDown = (event) => {
      // Prevent default browser behavior and text selection
      event.preventDefault();

      // Store initial position and dimensions
      startX = event.clientX;
      initialWidth = this.nodes.image.offsetWidth;

      // Calculate aspect ratio (width / height)
      aspectRatio = initialWidth / this.nodes.image.offsetHeight;

      // Add event listeners for mouse move and mouse up
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // Add a class to indicate resizing is in progress
      document.body.classList.add('image-resizing');
    };

    // Attach the initial mousedown event
    handle.addEventListener('mousedown', onMouseDown);
  }

  /**
   * Callback to update data when image is resized
   *
   * @param {object} dimensions - The new dimensions of the image
   * @returns {void}
   */
  onImageResize(dimensions) {
    if (typeof this.onResize === 'function') {
      this.onResize(dimensions);
    }
  }

  /**
   * On image load callback
   * Shows the embedded image
   *
   * @returns {void}
   */
  onImageLoad() {
    this.nodes.imageHolder.prepend(this.nodes.image);
    this.nodes.wrapper.appendChild(this.nodes.imageHolder);
    this.nodes.wrapper.appendChild(this.nodes.caption);
    this.nodes.loader.remove();

    // Apply saved dimensions if they exist
    if (this.data && this.data.width && this.data.height) {
      this.nodes.image.style.width = `${this.data.width}px`;
      this.nodes.image.style.height = `${this.data.height}px`;
    }

    // Add resize handles to image
    this.addResizeHandles();

    // Make sure stretched property still works
    if (this.data && this.data.stretched) {
      this.applyTune('stretched', true);
    }
  }

  /**
   * Callback fired when image fails on load.
   * It removes current editor block and notifies error
   *
   * @returns {void}
   */
  onImageLoadError() {
    this.removeCurrentBlock();
    this.api.notifier.show({
      message: 'Can not load the image, try again!',
      style: 'error',
    });
  }

  /**
   * Removes current block from editor
   *
   * @returns {void}
   */
  removeCurrentBlock() {
    Promise.resolve().then(() => {
      const blockIndex = this.api.blocks.getCurrentBlockIndex();

      this.api.blocks.delete(blockIndex);
    })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      });
  }

  /**
   * Makes buttons with tunes
   *
   * @returns {HTMLDivElement}
   */
  renderSettings(data) {
    return this.tunes.render(data);
  }

  /**
   * Shows a loader spinner
   *
   * @returns {void}
   */
  showLoader() {
    this.nodes.controlPanelWrapper.remove();
    this.nodes.wrapper.appendChild(this.nodes.loader);
  }

  /**
   * Callback fired when an image is embedded
   *
   * @param {Object} data Tool data
   * @returns {void}
   */
  selectImage(data) {
    this.onAddImageData(data);
    this.showLoader();
    this.buildImageCredits(data);
  }

  /**
   * Apply visual representation of activated tune
   *
   * @param {string} tuneName One of available tunes
   * @param {boolean} status True for enable, false for disable
   * @returns {void}
   */
  applyTune(tuneName, status) {
    // Handle the case where imageHolder might not be initialized yet (during tests)
    if (!this.nodes.imageHolder) {
      return;
    }

    // Only toggle class for tunes that have visual states (not for action tunes like 'size')
    if (tuneName !== 'size') {
      this.nodes.imageHolder.classList.toggle(`${this.CSS.imageHolder}--${tuneName}`, status);
    }

    if (tuneName === 'stretched') {
      // Handle visibility of resize handles when stretched
      if (this.nodes.leftHandle && this.nodes.rightHandle) {
        this.nodes.leftHandle.style.display = status ? 'none' : '';
        this.nodes.rightHandle.style.display = status ? 'none' : '';
      }

      // Make image width 100% when stretched
      if (this.nodes.image) {
        if (status) {
          this.nodes.image.style.width = '100%';
          this.nodes.image.style.height = 'auto';
        }
      }

      // Only call API methods if we're not in a test environment
      if (this.api && this.api.blocks) {
        Promise.resolve().then(() => {
          const blockIndex = this.api.blocks.getCurrentBlockIndex();
          this.api.blocks.stretchBlock(blockIndex, status);
        })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(err);
          });
      }
    } else if (tuneName === 'size' && this.nodes.image) {
      // Only open dialog if we have an image (prevents issues in tests)
      try {
        this.createDimensionDialog();
      } catch (err) {
        console.error('Error creating dimension dialog:', err);
      }
    }
  }

  /**
   * Apply tunes to image from data
   *
   * @param {Object} data Tool data
   * @returns {void}
   */
  applySettings(data) {
    this.data = data; // Store data reference for later use

    // Only apply regular toggle tunes (not action tunes like 'size')
    this.settings.forEach((tune) => {
      if (tune.name !== 'size') {
        this.applyTune(tune.name, data[tune.name]);
      }
    });
  }

  /**
   * Capture events in the Inline Image block
   */
  setEvents() {
    this.nodes.image.addEventListener('click', () => {
      this.modal.open(this.nodes.image.src);
    });
  }

  /**
   * Creates and displays a dimension setting dialog
   *
   * @returns {HTMLElement} - The dialog element
   */
  createDimensionDialog() {
    const wrapper = make('div', 'inline-image__dimension-dialog');
    const form = make('div', 'inline-image__dimension-form');

    // Current dimensions
    const currentWidth = this.nodes.image.offsetWidth;
    const currentHeight = this.nodes.image.offsetHeight;
    const aspectRatio = currentWidth / currentHeight;

    // Width input
    const widthLabel = make('label', null, { innerHTML: 'Width (px):' });
    const widthInput = make('input', 'inline-image__dimension-input', {
      type: 'number',
      value: currentWidth,
      min: 50,
      step: 10,
    });

    // Height input
    const heightLabel = make('label', null, { innerHTML: 'Height (px):' });
    const heightInput = make('input', 'inline-image__dimension-input', {
      type: 'number',
      value: currentHeight,
      min: 50,
      step: 10,
    });

    // Get editor width for constraint with fallback for testing environment
    let editorWidth = 800; // Default fallback width
    try {
      const editorEl = this.nodes.wrapper.closest('.codex-editor__redactor');
      if (editorEl) {
        editorWidth = editorEl.offsetWidth - 40; // Subtract padding
      }
    } catch (e) {
      console.log('Editor element not found, using default width constraint', e);
    }

    // Width change handler
    widthInput.addEventListener('input', () => {
      const newWidth = parseInt(widthInput.value, 10) || currentWidth;
      const constrainedWidth = Math.min(newWidth, editorWidth);
      widthInput.value = constrainedWidth;
      heightInput.value = Math.round(constrainedWidth / aspectRatio);
    });

    // Height change handler
    heightInput.addEventListener('input', () => {
      const newHeight = parseInt(heightInput.value, 10) || currentHeight;
      const newWidth = Math.round(newHeight * aspectRatio);
      const constrainedWidth = Math.min(newWidth, editorWidth);
      if (newWidth !== constrainedWidth) {
        heightInput.value = Math.round(constrainedWidth / aspectRatio);
        widthInput.value = constrainedWidth;
      } else {
        widthInput.value = newWidth;
      }
    });

    // Buttons
    const buttonWrapper = make('div', 'inline-image__dimension-buttons');
    const applyButton = make('button', 'inline-image__dimension-button', {
      innerHTML: 'Apply',
      type: 'button',
      onclick: () => {
        const newWidth = parseInt(widthInput.value, 10);
        const newHeight = parseInt(heightInput.value, 10);

        if (newWidth && newHeight) {
          this.nodes.image.style.width = `${newWidth}px`;
          this.nodes.image.style.height = `${newHeight}px`;

          this.onImageResize({
            width: newWidth,
            height: newHeight,
          });

          wrapper.remove();
        }
      },
    });

    const cancelButton = make('button', 'inline-image__dimension-button', {
      innerHTML: 'Cancel',
      type: 'button',
      onclick: () => wrapper.remove(),
    });

    // Build the form
    form.appendChild(widthLabel);
    form.appendChild(widthInput);
    form.appendChild(heightLabel);
    form.appendChild(heightInput);

    buttonWrapper.appendChild(applyButton);
    buttonWrapper.appendChild(cancelButton);

    form.appendChild(buttonWrapper);
    wrapper.appendChild(form);

    // Add to the UI
    this.nodes.wrapper.appendChild(wrapper);

    return wrapper;
  }
}
