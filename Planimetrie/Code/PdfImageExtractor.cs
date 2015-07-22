using BitMiracle.LibTiff.Classic;
using iTextSharp.text.pdf;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace Planimetrie
{
    public class PdfImageExtractor
    {
        /// <summary>
        ///  Extract Image from PDF file and Store in Image Object
        /// </summary>
        /// <param name="pdfPath">Specify PDF Source Path</param>
        /// <returns>elenco dei path relativi alle immagini estratte</returns>
        public static List<string> ExtractImages(String pdfPath)
        {            
            var pathTokens = pdfPath.Split(new char[] { '\\' });            
            var session = pathTokens[pathTokens.Length - 2];
            var basePath = Path.GetDirectoryName(pdfPath);
            var filename = Path.GetFileNameWithoutExtension(pdfPath);

            List<string> urls = new List<string>();

           RandomAccessFileOrArray RAFObj = null;
            PdfReader PDFReaderObj = null;
            PdfObject PDFObj = null;
            PdfStream PDFStreamObj = null;

            //try
            //{
            RAFObj = new RandomAccessFileOrArray(pdfPath);//(PDFSourcePath);
            PDFReaderObj = new PdfReader(RAFObj, null);

            var info = PDFReaderObj.Info;          
            var j = 0;
            for (int i = 0; i <= PDFReaderObj.XrefSize - 1; i++)
            {
                PDFObj = PDFReaderObj.GetPdfObject(i);

                if ((PDFObj != null) && PDFObj.IsStream())
                {
                    PdfDictionary pd = (PdfDictionary)PDFObj;

                    PDFStreamObj = (iTextSharp.text.pdf.PdfStream)PDFObj;
                    iTextSharp.text.pdf.PdfObject subtype = PDFStreamObj.Get(iTextSharp.text.pdf.PdfName.SUBTYPE);

                    if ((subtype != null) && subtype.ToString() == iTextSharp.text.pdf.PdfName.IMAGE.ToString())
                    {
                        filename = filename + "_" + (++j).ToString();
                        byte[] bytes = PdfReader.GetStreamBytesRaw((iTextSharp.text.pdf.PRStream)PDFStreamObj);

                        Tiff tiff = Tiff.Open(Path.Combine(basePath, filename + ".tif"), "w");
                        tiff.SetField(TiffTag.IMAGEWIDTH, UInt32.Parse(pd.Get(PdfName.WIDTH).ToString()));
                        tiff.SetField(TiffTag.IMAGELENGTH, UInt32.Parse(pd.Get(PdfName.HEIGHT).ToString()));
                        tiff.SetField(TiffTag.COMPRESSION, Compression.CCITTFAX4);
                        tiff.SetField(TiffTag.BITSPERSAMPLE, UInt32.Parse(pd.Get(PdfName.BITSPERCOMPONENT).ToString()));
                        tiff.SetField(TiffTag.SAMPLESPERPIXEL, 1);
                        tiff.WriteRawStrip(0, bytes, bytes.Length);
                        tiff.Close();

                        var bmp = tiffToBitmap(Path.Combine(basePath, filename + ".tif"));
                        if (bmp != null)
                        {
                            bmp.Save(Path.Combine(basePath, filename + ".bmp"));
                            urls.Add( session + "/" + filename + ".bmp");
                        }
                    }
                }
            }
            PDFReaderObj.Close();
            return urls;
        }

        private static Bitmap tiffToBitmap(string fileName)
        {
            using (Tiff tif = Tiff.Open(fileName, "r"))
            {
                if (tif == null)
                    return null;

                FieldValue[] imageHeight = tif.GetField(TiffTag.IMAGELENGTH);
                int height = imageHeight[0].ToInt();

                FieldValue[] imageWidth = tif.GetField(TiffTag.IMAGEWIDTH);
                int width = imageWidth[0].ToInt();

                FieldValue[] bitsPerSample = tif.GetField(TiffTag.BITSPERSAMPLE);
                short bpp = bitsPerSample[0].ToShort();
                if (bpp != 1)
                    return null;

                FieldValue[] samplesPerPixel = tif.GetField(TiffTag.SAMPLESPERPIXEL);
                short spp = samplesPerPixel[0].ToShort();
                if (spp != 1)
                    return null;

                FieldValue[] photoMetric = tif.GetField(TiffTag.PHOTOMETRIC);
                if (photoMetric != null)
                {
                    Photometric photo = (Photometric)photoMetric[0].ToInt();
                    if (photo != Photometric.MINISBLACK && photo != Photometric.MINISWHITE)
                        return null;
                }

                int stride = tif.ScanlineSize();
                Bitmap result = new Bitmap(width, height, PixelFormat.Format1bppIndexed);

                // update bitmap palette according to Photometric value
                bool minIsWhite = true;// (photo == Photometric.MINISWHITE);
                ColorPalette palette = result.Palette;
                palette.Entries[0] = (minIsWhite ? Color.White : Color.Black);
                palette.Entries[1] = (minIsWhite ? Color.Black : Color.White);
                result.Palette = palette;

                for (int i = 0; i < height; i++)
                {
                    Rectangle imgRect = new Rectangle(0, i, width, 1);
                    BitmapData imgData = result.LockBits(imgRect, ImageLockMode.WriteOnly, PixelFormat.Format1bppIndexed);

                    byte[] buffer = new byte[stride];
                    tif.ReadScanline(buffer, i);

                    Marshal.Copy(buffer, 0, imgData.Scan0, buffer.Length);
                    result.UnlockBits(imgData);
                }

                return result;
            }
        }
    }
}