/// <reference path="/Scripts/knockout-3.0.0.js" />

/*jslint browser: true, devel: true */
/*global $, AjaxUpload, ko, ctx, END_CLICK_RADIUS*/

var Point = function (x, y) {
    'use strict';
    this.x = x;
    this.y = y;
};

var Scalatura = function () {
    'use strict';
    var self = this;
    self.linea = ko.observableArray([]);
    self.lunghezzaInMetri = ko.observable();
    self.pxPerMetro = function () {
        var dpcm = 200 / 2.54,//200 dpi trasformati su cm
            deltaX = 0,
            deltaY = 0,
            ipotenusa;

        if (self.linea() && self.linea().length === 2) {
            deltaX = Math.abs(self.linea()[1].x - self.linea()[0].x);
            deltaY = Math.abs(self.linea()[1].y - self.linea()[0].y);
            ipotenusa = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            return ipotenusa / self.lunghezzaInMetri();
        } else {
            return dpcm * 100 / $('#scala').val();
        }
    };
};

var ConsistenzaVM = function () {
    'use strict';
    var self = this;
    self.pxPerMetro = ko.observable();
    self.piano = ko.observable().extend({ required: true });
    self.destinazione = ko.observable();
    self.uso = ko.observable();
    self.note = ko.observable();
    self.coeff = ko.observable();
    self.isSelected = ko.observable(false);

    self.punti = ko.observableArray();

    self.area = ko.computed(function () {
        var area = 0,         // Accumulates area in the loop
            pnts = self.punti(),
            j,
            i;
        j = pnts.length - 1;  // The last vertex is the 'previous' one to the first
        for (i = 0; i < pnts.length; i += 1) {
            area = area + (pnts[j].x + pnts[i].x) * (pnts[j].y - pnts[i].y);
            j = i;  //j is previous vertex to i
        }

        //return (Math.abs(area) / 2) / (dpcm * dpcm) * self.scala() * self.scala() / 100 / 100;
        return (Math.abs(area) / 2) / (self.pxPerMetro() * self.pxPerMetro());
    });

    self.areaRagguagliata = ko.computed(function () { return self.area() * self.coeff(); });
};

var ImmagineVM = function (url, context, imageContext, canvas) {
    'use strict';
    var self = this,
        i = 0;

    self.context = ko.observable(context);
    self.canvas = ko.observable(canvas);
    self.url = ko.observable(url);
    self.consistenze = ko.observableArray([]);
    self.consistenzaAttiva = ko.observable();

    self.isStarted = ko.observable();
    self.isTuning = ko.observable();

    self.scalaBase = ko.observable(200);
    self.scaling = ko.observable();
    self.scaling(new Scalatura());

    self.mouseX = ko.observable();
    self.mouseY = ko.observable();
    self.points = ko.observableArray();

    self.selectConsistenza = function (cons, e) {
        for (i = 0; i < self.consistenze().length; i += 1) {
            if (self.consistenze()[i] === cons) {
                self.consistenze()[i].isSelected(true);
            } else {
                self.consistenze()[i].isSelected(false);
            }
        }
        e.stopPropagation();
    };

    self.addConsistenza = function (vm) {
        var cons = vm.immagine().consistenzaAttiva();
        //if (cons.isValid) {
        cons.isSelected(false);
        if (self.consistenze.indexOf(cons) < 0) {
            self.consistenze.push(cons);
        }
        $('#myModal').modal('hide');
        //}
    };
    self.editConsistenza = function (cons, e) {
        self.consistenzaAttiva(cons);
        $('#myModal').modal();
        e.stopPropagation();
    };
    self.removeConsistenza = function (cons, e) {
        self.consistenze.remove(cons);
        e.stopPropagation();
    };

    self.areaTotale = ko.computed(function () {
        var area = 0, i;
        for (i = 0; i < self.consistenze().length; i += 1) {
            area += self.consistenze()[i].areaRagguagliata();
        }
        return area;
    }, self);

    self.mouseMove = function (data, e) {
        self.mouseX(e.pageX / self.zoomFactor()); //e.clientX - canvas.offsetLeft;
        self.mouseY(e.pageY / self.zoomFactor()); //e.clientY - canvas.offsetTop; 
    };
    self.mouseDown = function (data, e) {
        e = e || window.event;
        switch (e.which) {
            case 1:
            case 2:
                break;
            case 3:
                self.isStarted(false);
                self.isTuning(false);
                self.points(null);
                break;
        }
    };
    self.contextMenu = function (data, e) {
        e.preventDefault();
    };
    self.keyUp = function (data, e) {
        if (e.keyCode === 27) { self.isStarted(false); self.points(null); }
    };
    self.setTuning = function (data, e) {
        self.scaling().linea([]);
        self.scaling().lunghezzaInMetri(null);
        self.isTuning(true);
    };
    self.canvasClick = function (data, e) {
        var x = e.pageX / self.zoomFactor(),
            y = e.pageY / self.zoomFactor(),
            cons;
        if (self.isTuning()) {
            if (self.scaling() && self.scaling().linea().length === 0) {
                self.scaling().linea()[0] = new Point(x, y);
            } else if (self.scaling() && self.scaling().linea().length === 1) {
                self.scaling().linea()[1] = new Point(x, y);
                self.isTuning(false);
                $('#scalaModal').modal();
            }
        }
        else if (self.isStarted()) {
            //drawing the next line, and closing the polygon if needed
            if (Math.abs(x - self.points()[0].x) < END_CLICK_RADIUS && Math.abs(y - self.points()[0].y) < END_CLICK_RADIUS) {
                self.isStarted(false);
                cons = new ConsistenzaVM()
                    .destinazione($('#destinazione').val())
                    .pxPerMetro(self.scaling().pxPerMetro())
                    .coeff(1)
                    .punti(self.points());
                self.consistenzaAttiva(cons);
                //polygons[polygons.length] = points;
                $('#myModal').modal();
                self.points(null);
            } else {
                self.points()[self.points().length] = new Point(x, y);
            }
        } else if (self.points() === null) {
            //opening the polygon
            self.points([]);
            self.points()[0] = new Point(x, y);
            self.isStarted(true);
        }
    };

    self.draw = function () {
        self.context().clearRect(0, 0, self.canvas().width, self.canvas().height);

        self.context().lineWidth = 2;

        var polygons = self.consistenze(),
            pnts,
            j;
        if (polygons !== null && polygons.length > 0) {
            for (j = 0; j < polygons.length; j += 1) {
                self.context().beginPath();
                self.context().fillStyle = polygons[j].isSelected() ? "rgba(220, 20, 60, 0.5)" : "rgba(128, 128, 128, 0.5)";
                self.context().strokeStyle = self.getColore(polygons[j].uso());
                pnts = polygons[j].punti();
                if (pnts !== null && pnts.length > 0) {
                    ctx.moveTo(pnts[0].x , pnts[0].y );

                    for (i = 1; i < pnts.length; i += 1) {
                        self.context().lineTo(pnts[i].x, pnts[i].y );
                    }

                    self.context().lineTo(pnts[0].x , pnts[0].y );
                }
                self.context().stroke();
                self.context().fill();
            }
        }

        if (self.points() !== null && self.points().length > 0) {
            self.context().beginPath();
            self.context().fillStyle = "rgba(128, 128, 128, 0.5)";
            self.context().strokeStyle = "red";
            self.context().moveTo(self.points()[0].x , self.points()[0].y );

            for (i = 1; i < self.points().length; i += 1) {
                self.context().lineTo(self.points()[i].x , self.points()[i].y);
            }

            if (self.isStarted()) {
                self.context().lineTo(self.mouseX() , self.mouseY() );
            } else {
                self.context().lineTo(self.points()[0].x , self.points()[0].y );
            }
            self.context().stroke();
            self.context().fill();
        }

        if (self.scaling() && self.scaling().linea().length > 0) {
            self.context().beginPath();
            self.context().fillStyle = "rgba(128, 128, 128, 0.5)";
            self.context().strokeStyle = "magenta";
            self.context().lineWidth = 4;
            self.context().moveTo(self.scaling().linea()[0].x , self.scaling().linea()[0].y );

            for (i = 1; i < self.scaling().linea().length; i += 1) {
                self.context().lineTo(self.scaling().linea()[i].x , self.scaling().linea()[i].y );
            }

            if (self.isTuning()) {
                self.context().lineTo(self.mouseX() , self.mouseY() );
            }
            self.context().stroke();
            self.context().fill();

            self.drawLabelMisura();
        }

    };

    self.getColore = function (uso) {
        //switch (uso) {
        //    case 'residenziale':
        //        return 'green';
        //    case 'locale tecnico':
        //        return 'red';
        //    case 'uffici':
        //        return 'blue';
        //    case 'balcone':
        //        return 'yellow';
        //    default:
        //        return 'magenta';
        //}
        return 'blue';
    };

    self.img_buffer = ko.observable();

    self.url.subscribe(function (newValue) {
        imageContext.clearRect(0, 0, imageContext.canvas.width, imageContext.canvas.height);
        context.canvas.width = 0;
        context.canvas.height = 0;
        imageContext.canvas.width = 0;
        imageContext.canvas.height = 0;
        self.img_buffer(new Image());
        self.img_buffer().src = self.url();
        self.zoomFactor(1);
        self.consistenze([]);
        self.img_buffer().onload = function () {
            var imgWidth = self.img_buffer().width,
                imgHeight = self.img_buffer().height;
            context.canvas.width = imgWidth;
            context.canvas.height = imgHeight;
            imageContext.canvas.width = imgWidth;
            imageContext.canvas.height = imgHeight;
            imageContext.drawImage(self.img_buffer(), 0, 0, imgWidth, imgHeight);

            // grid();
        };
    });

    self.drawLabelMisura = function () {
        if (self.scaling().lunghezzaInMetri()) {
            var p1 = self.scaling().linea()[0],
                p2 = self.scaling().linea()[1],
                text = self.scaling().lunghezzaInMetri() + ' m',
                alignment = 'center',
                ctx = self.context(),
                dx = p2.x - p1.x,
                dy = p2.y - p1.y,
                p, pad;

            p = p1;
            pad = 1 / 2;

            ctx.save();
            ctx.font = "20px Verdana";
            ctx.textAlign = alignment;
            ctx.translate(p.x + dx * pad, p.y + dy * pad);
            ctx.rotate(Math.atan2(dy, dx));
            ctx.strokeStyle = "magenta";
            ctx.lineWidth = 4;
            ctx.strokeText(text, 0, 0);
            ctx.fillStyle = "white";
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
    }

    self.zoomFactor = ko.observable(1);

    self.zoomIn = function () {
        self.zoom(1);
    };
    self.zoomOut = function () {
        self.zoom(-1);
    };
    self.zoom = function (clicks) {
        var lastX = self.canvas().width / 2,
            lastY = self.canvas().height / 2,
             ctx = self.context();
        
        self.zoomFactor(self.zoomFactor() + (clicks * 0.25));
        var factor = Math.pow(1.1, clicks);

        self.canvas().width = self.img_buffer().width * self.zoomFactor();
        self.canvas().height = self.img_buffer().height * self.zoomFactor();

        //ctx.translate(lastX, lastY);        
        context.scale(self.zoomFactor(), self.zoomFactor());
        //ctx.translate(-lastX, -lastY);

        imageContext.clearRect(0, 0, imageContext.canvas.width, imageContext.canvas.height);
        imageContext.canvas.width = self.img_buffer().width * self.zoomFactor();
        imageContext.canvas.height = self.img_buffer().height * self.zoomFactor();
        
        //imageContext.translate(lastX, lastY);
        //imageContext.scale(factor, factor);
        //imageContext.translate(-lastX, -lastY);
        imageContext.drawImage(self.img_buffer(), 0, 0, self.img_buffer().width * self.zoomFactor(), self.img_buffer().height * self.zoomFactor());
        imageContext.scale(self.zoomFactor(), self.zoomFactor());
        //redraw();
    };
};

var PlanimetriaVM = function (nome, url, context, imageContext, canvas) {
    'use strict';

    var self = this,
        item = new ImmagineVM(url, context, imageContext, canvas);

    self.nome = nome;
    self.immagine = ko.observable();

    self.immagine(item);

    self.areaTotale = ko.computed(function () {
        return (self.immagine() ? self.immagine().areaTotale() : 0);
    });

    self.reset = function () {
        if (self.immagine()) {
            self.immagine().consistenze([]);
        }
    };

    self.toJSON = ko.computed(function () {
        var data = ko.toJS(self.immagine().consistenze);
        data.forEach(function (entry) {
            delete entry.punti;
            delete entry.destinazione.usi;
            delete entry.isSelected;
        });
        return ko.toJSON(data);
    });
};
