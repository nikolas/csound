goog.provide("csound.utils.text_encoders");

/** @define {boolean} */
const WITH_TEXT_ENCODER_POLYFILL = goog.define("WITH_TEXT_ENCODER_POLYFILL", false);

if (WITH_TEXT_ENCODER_POLYFILL) {
  // FROM https://gitlab.com/PseudoPsycho/text-encoding-shim/-/blob/master/index.js
  const utf8Encodings = new Set(["utf8", "utf-8", "unicode-1-1-utf-8"]);

  const TextEncoderPoly = function (encoding) {
    if (!utf8Encodings.has(encoding) && typeof encoding !== "undefined" && encoding !== null) {
      throw new RangeError("Invalid encoding type. Only utf-8 is supported");
    } else {
      this.encoding = "utf-8";
      return this;
      // this.encode
    }
  };

  TextEncoderPoly.prototype.encode = function (str) {
    if (typeof str !== "string") {
      throw new TypeError("passed argument must be of type string " + str + " " + typeof str);
    }
    const binstr = unescape(encodeURIComponent(str));
    const array = new Uint8Array(binstr.length);
    binstr.split("").forEach(function (char, index) {
      array[index] = char.charCodeAt(0);
    });
    return array;
  };

  function TextDecoderPoly(encoding, options) {
    if (!utf8Encodings.has(encoding) && typeof encoding !== "undefined" && encoding !== null) {
      throw new RangeError("Invalid encoding type. Only utf-8 is supported");
    }
    this.encoding = "utf-8";
    this.ignoreBOM = false;
    this.fatal = typeof options !== "undefined" && "fatal" in options ? options.fatal : false;
    if (typeof this.fatal !== "boolean") {
      throw new TypeError("fatal flag must be boolean");
    }
    this.trimNull = (a) => {
      const c = a.indexOf("\0");
      if (c > -1) {
        return a.slice(0, Math.max(0, c));
      }
      return a;
    };

    this.decode = function (view, options) {
      if (typeof view === "undefined") {
        return "";
      }

      const stream = typeof options !== "undefined" && "stream" in options ? options.stream : false;
      if (typeof stream !== "boolean") {
        throw new TypeError("stream option must be boolean");
      }

      if (!ArrayBuffer.isView(view)) {
        throw new TypeError("passed argument must be an array buffer view");
      } else {
        const array = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        const charArray = new Array(array.length);
        array.forEach(function (charcode, index) {
          charArray[index] = String.fromCharCode(charcode);
        });
        return this.trimNull(charArray.join(""));
      }
    };
  }

  const decoder = new TextDecoderPoly("utf-8");
  const encoder = new TextEncoderPoly("utf-8");

  const uint2String = (uint) => decoder.decode(uint);

  csound.utils.text_encoders.encoder = encoder;
  csound.utils.text_encoders.decoder = decoder;
  csound.utils.text_encoders.uint2String = uint2String;
}

if (!WITH_TEXT_ENCODER_POLYFILL) {
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder("utf-8");

  const uint2String = (uint) => decoder.decode(uint);

  csound.utils.text_encoders.encoder = encoder;
  csound.utils.text_encoders.decoder = decoder;
  csound.utils.text_encoders.uint2String = uint2String;
}
