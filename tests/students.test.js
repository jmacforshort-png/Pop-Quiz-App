const { StudentServiceError, createStudentService } = require("../src/server/studentService");

function createStudentPrismaMock() {
  const classes = [
    { id: "class_1", adminId: "admin_1", name: "Biology", blockNumber: 1 },
    { id: "class_2", adminId: "admin_1", name: "Chemistry", blockNumber: 2 },
    { id: "class_3", adminId: "admin_2", name: "Physics", blockNumber: 1 },
  ];

  const users = [
    {
      id: "student_1",
      username: "amy",
      role: "student",
      mustChangePassword: false,
      createdAt: new Date(),
      classId: "class_1",
    },
    {
      id: "student_2",
      username: "brad",
      role: "student",
      mustChangePassword: false,
      createdAt: new Date(),
      classId: "class_2",
    },
    {
      id: "student_3",
      username: "zane",
      role: "student",
      mustChangePassword: false,
      createdAt: new Date(),
      classId: "class_3",
    },
  ];

  return {
    user: {
      findMany: async ({ where }) => {
        const filtered = users
          .filter((user) => user.role === where.role)
          .filter((user) => {
            const classInfo = classes.find((item) => item.id === user.classId);
            if (!classInfo) {
              return false;
            }

            if (classInfo.adminId !== where.class.adminId) {
              return false;
            }

            if (where.classId && user.classId !== where.classId) {
              return false;
            }

            if (where.class.blockNumber && classInfo.blockNumber !== where.class.blockNumber) {
              return false;
            }

            return true;
          })
          .sort((a, b) => a.username.localeCompare(b.username));

        return filtered.map((user) => {
          const classInfo = classes.find((item) => item.id === user.classId);
          return {
            id: user.id,
            username: user.username,
            mustChangePassword: user.mustChangePassword,
            createdAt: user.createdAt,
            classId: user.classId,
            class: {
              id: classInfo.id,
              name: classInfo.name,
              blockNumber: classInfo.blockNumber,
            },
          };
        });
      },
    },
  };
}

describe("student service", () => {
  it("returns only students owned by admin", async () => {
    const prisma = createStudentPrismaMock();
    const studentService = createStudentService({ prisma });

    const students = await studentService.listStudents("admin_1");

    expect(students).toHaveLength(2);
    expect(students.map((student) => student.username)).toEqual(["amy", "brad"]);
  });

  it("filters by block number", async () => {
    const prisma = createStudentPrismaMock();
    const studentService = createStudentService({ prisma });

    const students = await studentService.listStudents("admin_1", { blockNumber: 2 });

    expect(students).toHaveLength(1);
    expect(students[0].username).toBe("brad");
  });

  it("rejects invalid filters", async () => {
    const prisma = createStudentPrismaMock();
    const studentService = createStudentService({ prisma });

    await expect(
      studentService.listStudents("admin_1", { blockNumber: -1 })
    ).rejects.toBeInstanceOf(StudentServiceError);
  });
});
