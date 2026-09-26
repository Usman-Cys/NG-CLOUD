import { FileText, Image, FileArchive, Film, Music, FileCode, File, Presentation, FileSpreadsheet } from 'lucide-react'
export function getFileIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return Image
  if (['zip','tar','gz','rar','7z'].includes(ext)) return FileArchive
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return Film
  if (['mp3','wav','flac','ogg'].includes(ext)) return Music
  if (['js','ts','jsx','tsx','py','java','c','cpp','go','rs','json','yaml','yml','sql'].includes(ext)) return FileCode
  if (['xls','xlsx','csv'].includes(ext)) return FileSpreadsheet
  if (['ppt','pptx'].includes(ext)) return Presentation
  if (['txt','md','pdf','doc','docx'].includes(ext)) return FileText
  return File
}
