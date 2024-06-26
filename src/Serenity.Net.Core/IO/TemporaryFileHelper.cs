namespace Serenity.IO;

/// <summary>
///   Contains helper functions for temporary files and folders</summary>
public class TemporaryFileHelper
{
    private static readonly TemporaryPhysicalFileSystem physicalFileSystem = new();

    /// <summary>
    ///   A signature file that marks a folder as a temporary file to ensure that it actually contains temporary
    ///   files and can be safely cleaned</summary>
    public const string DefaultTemporaryCheckFile = ".temporary";

    /// <summary>
    ///   By default, files older than 1 hour is cleared</summary>
    public static readonly TimeSpan DefaultAutoExpireTime = TimeSpan.FromDays(1);

    /// <summary>
    ///   By default, if more than 1000 files exists in directory, they are deleted</summary>
    public const int DefaultMaxFilesInDirectory = 1000;

    /// <summary>
    ///   Clears a folder based on default conditions</summary>
    /// <param name="directoryToClean">
    ///   Folder to be cleared</param>
    /// <param name="fileSystem">File system</param>
    /// <remarks>
    ///   If any errors occur during cleanup, this doesn't raise an exception
    ///   and ignored. Other errors might raise an exception. As errors are
    ///   ignored, method can't guarantee that less than specified number of files
    ///   will be in the folder after it ends.</remarks>
    public static void PurgeDirectoryDefault(string directoryToClean, ITemporaryFileSystem? fileSystem = null)
    {
        PurgeDirectory(directoryToClean, DefaultAutoExpireTime, DefaultMaxFilesInDirectory, DefaultTemporaryCheckFile, fileSystem);
    }

    /// <summary>
    ///   Clears a folder based on specified conditions</summary>
    /// <param name="directoryToClean">
    ///   Folder to be cleared</param>
    /// <param name="autoExpireTime">
    ///   Files with creation time older than this is deleted. If passed as 0, time
    ///   based cleanup is skipped.</param>
    /// <param name="maxFilesInDirectory">
    ///   If more than this number of files exists, files will be deleted starting from 
    ///   oldest to newest. By passing 0, all files can be deleted. If passed as -1,
    ///   file count based cleanup is skipped.</param>
    /// <param name="checkFileName">
    ///   Safety file to be checked. If it is specified and it doesn't exists, operation
    ///   is aborted.</param>
    /// <param name="fileSystem">File system</param>
    /// <remarks>
    ///   If any errors occur during cleanup, this doesn't raise an exception
    ///   and ignored. Other errors might raise an exception. As errors are
    ///   ignored, method can't guarantee that less than specified number of files
    ///   will be in the folder after it ends.</remarks>
    public static void PurgeDirectory(string directoryToClean,
        TimeSpan autoExpireTime, int maxFilesInDirectory, string checkFileName, ITemporaryFileSystem? fileSystem = null)
    {
        fileSystem ??= physicalFileSystem;

        checkFileName ??= string.Empty;
        if (checkFileName.Length > 0)
        {
            checkFileName = fileSystem.GetFileName(checkFileName).Trim();
            if (!fileSystem.FileExists(fileSystem.Combine(directoryToClean, checkFileName)))
                return;
        }

        // if no time condition, or all files are to be deleted (maxFilesInDirectory = 0) 
        // no need for this part
        if (autoExpireTime.Ticks != 0 && maxFilesInDirectory != 0)
        {
            // subtract limit from now and find lower limit for files to be deleted
            DateTime autoExpireLimit = DateTime.Now.Subtract(autoExpireTime);

            // traverse all files and if older than limit, try to delete
            foreach (var fiOld in fileSystem.GetTemporaryFileInfos(directoryToClean)
                .Where(fi => fi.CreationTime < autoExpireLimit))
            {
                if (!checkFileName.Equals(fiOld.Name, StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        fileSystem.DeleteFile(fiOld.FullName!);
                    }
                    catch
                    {
                    }
                }
            }
        }

        // if maxFilesInDirectory is -1 than no count based deletion
        if (maxFilesInDirectory >= 0)
        {
            // list all files
            var files = fileSystem.GetTemporaryFileInfos(directoryToClean);

            // if count is above limit
            if (files.Length > maxFilesInDirectory)
            {
                // if not all files are going to be deleted, sort them by date
                if (maxFilesInDirectory != 0)
                {
                    Array.Sort(files,
                        delegate (TemporaryFileInfo x, TemporaryFileInfo y)
                        { return x.CreationTime < y.CreationTime ? -1 : 1; });
                }

                // delete all before last "maxFilesInDirectory" files.
                for (int i = 0; i < files.Length - maxFilesInDirectory; i++)
                {
                    if (!checkFileName.Equals(files[i].Name, StringComparison.OrdinalIgnoreCase))
                        try
                        {
                            fileSystem.DeleteFile(files[i].FullName!);
                        }
                        catch
                        {
                        }
                }
            }
        }
    }

    /// <summary>
    ///   Tries to delete a file with given path.</summary>
    /// <param name="filePath">
    ///   File to be deleted (can be null).</param>
    /// <param name="fileSystem">File system</param>
    public static void TryDelete(string filePath, IFileSystem? fileSystem = null)
    {
        fileSystem ??= physicalFileSystem;

        if (fileSystem.FileExists(filePath))
            try
            {
                Delete(filePath, fileSystem);
            }
            catch
            {

            }
    }

    /// <summary>
    ///   Deletes a file.</summary>
    /// <param name="filePath">
    ///   File to be deleted (can be null).</param>
    /// <param name="fileSystem"></param>
    public static void Delete(string filePath, IFileSystem? fileSystem = null)
    {
        fileSystem ??= physicalFileSystem;

        if (fileSystem.FileExists(filePath))
            fileSystem.DeleteFile(filePath);
        filePath += ".delete";
        if (fileSystem.FileExists(filePath))
            try
            {
                fileSystem.DeleteFile(filePath);
            }
            catch
            {
            }
    }

    /// <summary>
    ///   Deletes, tries to delete or marks a file for deletion depending on type.</summary>
    /// <param name="filePath">
    ///   File to be deleted (can be null).</param>
    /// <param name="type">
    ///   Delete type.</param>
    /// <param name="fileSystem">File system</param>
    public static void Delete(string filePath, DeleteType type, ITemporaryFileSystem? fileSystem = null)
    {
        if (type == DeleteType.Delete)
            Delete(filePath, fileSystem);
        else if (type == DeleteType.TryDelete)
            TryDelete(filePath, fileSystem);
        else
            TryDeleteOrMark(filePath, fileSystem);
    }

    /// <summary>
    ///   Tries to delete a file or marks it for deletion by DeleteMarkedFiles method by
    ///   creating a ".delete" file.</summary>
    /// <param name="filePath">
    ///   File to be deleted</param>
    /// <param name="fileSystem">File system</param>
    public static void TryDeleteOrMark(string filePath, ITemporaryFileSystem? fileSystem = null)
    {
        fileSystem ??= physicalFileSystem;
        TryDelete(filePath, fileSystem);
        if (fileSystem.FileExists(filePath))
        {
            try
            {
                string deleteFile = filePath + ".delete";
                long fileTime = fileSystem.GetLastWriteTimeUtc(filePath).ToFileTimeUtc();
                fileSystem.WriteAllText(deleteFile, fileTime.ToInvariant());
            }
            catch
            {
            }
        }
    }

    /// <summary>
    ///   Tries to delete all files that is marked for deletion by TryDeleteOrMark in a folder.</summary>
    /// <param name="path">
    ///   Path of marked files to be deleted</param>
    /// <param name="fileSystem">File system</param>
    public static void TryDeleteMarkedFiles(string path, ITemporaryFileSystem? fileSystem = null)
    {
        fileSystem ??= physicalFileSystem;

        if (!fileSystem.DirectoryExists(path))
            return;

        foreach (var name in fileSystem.GetFiles(path, "*.delete"))
        {
            try
            {
                string readLine = fileSystem.ReadAllText(name);
                string actualFile = name[0..^7];
                if (fileSystem.FileExists(actualFile))
                {
                    if (long.TryParse(readLine, out long fileTime))
                    {
                        if (fileTime == fileSystem.GetLastWriteTimeUtc(actualFile).ToFileTimeUtc())
                            TryDelete(actualFile, fileSystem);
                    }
                    TryDelete(name, fileSystem);
                }
                else
                    TryDelete(name, fileSystem);
            }
            catch
            {
            }
        }
    }

    /// <summary>
    ///   Gets a 13 character random code that can be used safely in a filename</summary>
    /// <returns>
    ///   A random code.</returns>
    public static string RandomFileCode()
    {
        Guid guid = Guid.NewGuid();
        var guidBytes = guid.ToByteArray();
        var eightBytes = new byte[8];
        for (int i = 0; i < 8; i++)
            eightBytes[i] = (byte)(guidBytes[i] ^ guidBytes[i + 8]);
        return Base32.Encode(eightBytes);
    }
}