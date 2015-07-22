/// <reference path="viewModel.js" />
/*jslint browser: true, devel: true */
/*global $, AjaxUpload, ko, PlanimetriaVM*/

/*
JavaScript polygon drawing
Sébastien CAPARROS
*/

//radius of click around the first point to close the draw
var END_CLICK_RADIUS = 8,
//the max number of points of your poygon
    MAX_POINTS = 50,

    canvas = null,
    ctx = null,
    canvasImg = null,
    ctxImg = null,

    mockVM = null;

var createUploader = function (ctrl) {
    'use strict';
    var up = new AjaxUpload(ctrl, {
        responseType: "json",
        action: '/api/File',
        onSubmit: function (file, ext) {
            this.disable();
        },
        onComplete: function (file, urls) {
            this.enable();
            if (urls && urls.length) {
                mockVM.immagine().points (null);
                mockVM.nome = file;
                mockVM.immagine().url("/api/file?mode=planimetria&file=" + urls[0]);
            } else {
                mockVM.immagine().url("");
                mockVM.reset();
                alert("Il pdf caricato non proviene dal sistema del Catasto o non contiene un'immagine valida!");
            }
        },
        onError: function (e) {
            alert(e);
        }
    });
};

$(function () {
    'use strict';
    ko.validation.init({
        errorElementClass: 'has-error',
        errorMessageClass: 'help-block',
        decorateElement: true
    });

    //upload
    createUploader($("#button5"));
    createUploader($("#splashUploader"));

    //initializing canvas and draw color
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    canvasImg = document.getElementById("canvasImg");
    ctxImg = canvasImg.getContext("2d");

    mockVM = new PlanimetriaVM('', '', ctx, ctxImg, canvas);
   // mockVM.immagine().url("documentodownload.html?mode=planimetria&file=2ec1cc86-7b04-47c3-ba9a-9d9aa878d065/99f6883e-6a5e-4e6e-9749-0b42fea42e1c/99f6883e-6a5e-4e6e-9749-0b42fea42e1c.png");

    ko.applyBindings(mockVM);

    //refresh time
    setInterval(mockVM.immagine().draw, 100);
});

function grid() {
    'use strict';
    var w = canvasImg.width,
        h = canvasImg.height,
        i;
    for (i = 0.5; i < w || i < h; i += 80) {
        // draw horizontal lines
        ctxImg.moveTo(i, 0);
        ctxImg.lineTo(i, h);
        // draw vertical lines
        ctxImg.moveTo(0, i);
        ctxImg.lineTo(w, i);
    }
    ctxImg.strokeStyle = 'hsla(0, 0%, 40%, .5)';
    ctxImg.stroke();
}